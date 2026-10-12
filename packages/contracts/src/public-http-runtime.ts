import { Ajv, type ValidateFunction } from "ajv";
import { fullFormats } from "ajv-formats/dist/formats.js";

import type {
  PublicHttpContractName,
  PublicHttpJsonOperationName,
  PublicHttpOperationResponse,
} from "./public-http-operation-types";
import type { JsonSchema, PublicHttpContract } from "./public-http-schema";
import { publicHttpContracts } from "./public-http-registry";

function pathsFromContracts<T extends Record<string, PublicHttpContract>>(
  contracts: T,
): { [Name in keyof T]: T[Name]["path"] } {
  return Object.fromEntries(
    Object.entries(contracts).map(([name, contract]) => [name, contract.path]),
  ) as { [Name in keyof T]: T[Name]["path"] };
}

export const apiPaths = pathsFromContracts(publicHttpContracts);

const publicHttpResponseAjv = new Ajv({ allErrors: true, strict: false });
publicHttpResponseAjv.addFormat("uuid", fullFormats.uuid);
publicHttpResponseAjv.addFormat("date-time", fullFormats["date-time"]);
const publicHttpResponseValidators = new Map<string, ValidateFunction>();

/**
 * 注册路由时按契约名绑定完整 schema：method、path、request、errors 与成功回复
 * 全部来自同一个 operation identity，宿主不再按 method+path 反查补全。
 */
export function applyPublicHttpContract(name: PublicHttpContractName): Record<string, unknown> {
  return publicHttpSchemaBoundTo(name);
}

// 已绑定契约的路由 schema 与其 operation identity；宿主 onRoute 据此校验注册一致性。
const boundPublicHttpSchemas = new Map<object, PublicHttpContractName>();

function publicHttpSchemaBoundTo(name: PublicHttpContractName): Record<string, unknown> {
  const contract = publicHttpContracts[name];
  const successResponse =
    contract.success.body.kind === "json"
      ? { [contract.success.status]: contract.success.body.schema }
      : {};
  const schema = {
    ...contract.request,
    response: { ...contract.errors, ...successResponse },
  };
  boundPublicHttpSchemas.set(schema, name);
  return schema;
}

/**
 * 宿主 onRoute 校验：每个公开路由必须通过契约名绑定完整 schema，且注册的
 * method/path 与契约一致，使“名字与路径不一致”在注册阶段就不可能发生。
 */
export function assertPublicHttpRouteBound(input: {
  method: string | string[];
  path: string;
  schema: unknown;
}): void {
  const methods = Array.isArray(input.method) ? input.method : [input.method];
  const name = boundPublicHttpSchemas.get(input.schema as object);
  if (name === undefined) {
    throw new Error(
      `Public HTTP route is not bound to a contract: ${methods.join(",")} ${input.path}`,
    );
  }
  const contract = publicHttpContracts[name];
  const methodMatches = methods.some(
    (method) => method === contract.method || (method === "HEAD" && contract.method === "GET"),
  );
  if (contract.path !== input.path || !methodMatches) {
    throw new Error(
      `Public HTTP route mismatch: ${methods.join(",")} ${input.path} does not match contract ${name}`,
    );
  }
}

export type PublicHttpResponseBodyKind = PublicHttpContract["success"]["body"]["kind"];

/** 所有浏览器响应模式都先验证精确成功状态与 body kind，不能把任意 2xx 当作成功。 */
export function assertPublicHttpResponseKind(
  name: PublicHttpContractName,
  status: number,
  expectedKind: PublicHttpResponseBodyKind,
): void {
  const success = publicHttpContracts[name].success;
  if (success.status !== status) {
    throw new TypeError(`Public HTTP contract ${name} does not declare success status ${status}`);
  }
  if (success.body.kind !== expectedKind) {
    throw new TypeError(`Public HTTP contract ${name} does not declare a ${expectedKind} response`);
  }
}

/** 浏览器 adapter 与 Fastify adapter 共享同一响应 schema，拒绝静默接受漂移的成功 envelope。 */
export function assertPublicHttpResponse<Name extends PublicHttpJsonOperationName>(
  name: Name,
  status: number,
  value: unknown,
): PublicHttpOperationResponse<Name> {
  assertPublicHttpResponseKind(name, status, "json");
  const body = publicHttpContracts[name].success.body;
  if (body.kind !== "json") throw new TypeError(`Public HTTP contract ${name} is not JSON`);
  const schema = body.schema;
  if (!publicHttpResponseValidator(name, status, schema)(value)) {
    throw new TypeError(`Public HTTP contract ${name} received an invalid response`);
  }
  // AJV 已用该 operation 的权威成功响应 schema 验证，类型收窄只发生在这个 seam 内。
  return value as PublicHttpOperationResponse<Name>;
}

function publicHttpResponseValidator(
  name: PublicHttpContractName,
  status: number,
  schema: JsonSchema,
): ValidateFunction {
  const cacheKey = `${name}:${status}`;
  const cached = publicHttpResponseValidators.get(cacheKey);
  if (cached) return cached;
  const compiled = publicHttpResponseAjv.compile(schema);
  publicHttpResponseValidators.set(cacheKey, compiled);
  return compiled;
}

export function buildApiPath(
  template: string,
  parameters: Record<string, string | number>,
): string {
  return template.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_placeholder, name: string) => {
    const value = parameters[name];
    if (value === undefined) {
      throw new TypeError(`Missing API path parameter: ${name}`);
    }
    return encodeURIComponent(String(value));
  });
}
