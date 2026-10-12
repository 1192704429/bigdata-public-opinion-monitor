import {
  buildApiPath,
  assertPublicHttpResponse,
  assertPublicHttpResponseKind,
  publicHttpContracts,
  type LoginResponse,
  type PublicHttpBinaryOperationName,
  type PublicHttpContractName,
  type PublicHttpEmptyOperationName,
  type PublicHttpJsonOperationName,
  type PublicHttpOperationResponse,
  type PublicHttpRequestArguments,
  type PublicHttpRequestOptions,
  type PublicHttpStreamOperationName,
} from "@aicp/contracts";
import { resolveBrowserApiEndpoint } from "./browser-endpoint";

export type { PublicHttpRequestOptions } from "@aicp/contracts";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * 会话失效兜底：后端作废会话（过期、改密、踢号、禁用）时，
 * 本地仍保留账号元数据、路由守卫无法感知，需要在此统一清理并跳转登录页。
 * 未注册时行为与以往一致（仅抛出 ApiError），保证 SSR 与测试环境安全。
 */
let sessionExpiredHandler: (() => void) | undefined;
let accessToken: string | undefined;

/** 登录成功后由应用注入当前 token；认证请求统一从这里读取。 */
export function setAccessToken(token: string | undefined): void {
  const normalized = token?.trim();
  accessToken = normalized ? normalized : undefined;
}

export function clearAccessToken(): void {
  accessToken = undefined;
}

export function setSessionExpiredHandler(handler: () => void): void {
  sessionExpiredHandler = handler;
}

/**
 * 会话失效判定：401 需要区分两类 —— invalid-credentials 是登录密码校验失败
 * （凭证本身没生效），其余 401（unauthorized）才是会话失效；主动 logout 由
 * 调用方自行清理，避免重复跳转。
 */
function isSessionExpiredResponse(
  status: number,
  errorCode: string | undefined,
  operation: string,
): boolean {
  return status === 401 && errorCode !== "invalid-credentials" && operation !== "logout";
}

export async function login(input: { loginName: string; password: string }): Promise<LoginResponse> {
  return requestOperation("login", {
    body: input,
  });
}

export async function logout(): Promise<void> {
  await requestOperationEmpty("logout");
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await requestOperationEmpty("changePassword", { body: input });
}

interface RuntimePublicHttpRequestOptions {
  parameters?: Record<string, string | number>;
  query?: Record<string, string | number | boolean>;
  headers?: HeadersInit;
  body?: unknown;
  /** 流式请求取消信号：前端「停止生成」中止 fetch，服务端 stream close 后 settle turn。 */
  signal?: AbortSignal;
}

/** 浏览器 adapter 从共享 contract 取得 method、path 与 body 规则，并统一解释错误 envelope。 */
export async function requestOperation<Name extends PublicHttpJsonOperationName>(
  name: Name,
  ...[options]: PublicHttpRequestArguments<Name>
): Promise<PublicHttpOperationResponse<Name>> {
  const response = await fetchOperation(name, options);
  return assertPublicHttpResponse(name, response.status, await response.json());
}

export async function requestOperationEmpty<Name extends PublicHttpEmptyOperationName>(
  name: Name,
  ...[options]: PublicHttpRequestArguments<Name>
): Promise<void> {
  const response = await fetchOperation(name, options);
  assertPublicHttpResponseKind(name, response.status, "empty");
  if ((await response.text()).length > 0) {
    throw new TypeError(`Public HTTP contract ${name} received a non-empty response`);
  }
}

export async function requestOperationBlob<Name extends PublicHttpBinaryOperationName>(
  name: Name,
  ...[options]: PublicHttpRequestArguments<Name>
): Promise<Blob> {
  const response = await fetchOperation(name, options);
  assertPublicHttpResponseKind(name, response.status, "binary");
  return response.blob();
}

export async function requestOperationStream<Name extends PublicHttpStreamOperationName>(
  name: Name,
  ...[options]: PublicHttpRequestArguments<Name>
): Promise<Response> {
  const response = await fetchOperation(name, options);
  assertPublicHttpResponseKind(name, response.status, "stream");
  return response;
}

/**
 * 上传 FormData 等非 JSON 请求。此类请求无法通过 JSON body contract 发送，
 * 仍复用 Bearer token、错误 envelope 与会话失效处理。
 */
export async function requestRawApi(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  appendAuthorization(headers);
  const response = await fetch(`${resolveBrowserApiEndpoint()}${path}`, {
    ...init,
    credentials: "omit",
    headers,
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => undefined)) as
      | { error?: string; message?: string; details?: unknown }
      | undefined;
    if (isSessionExpiredResponse(response.status, error?.error, "raw-api")) {
      handleSessionExpired();
    }
    throw new ApiError(
      response.status,
      error?.error ?? "request-failed",
      error?.message ?? `Request failed with status ${response.status}`,
      error && typeof error.details === "object" && error.details !== null
        ? (error.details as Record<string, unknown>)
        : undefined,
    );
  }
  return response;
}

async function fetchOperation<Name extends PublicHttpContractName>(
  name: Name,
  options: PublicHttpRequestOptions<Name> | undefined,
): Promise<Response> {
  // 泛型 options 已由 operation name 约束；此处只把联合字段归一化供 fetch 使用。
  const runtimeOptions = (options ?? {}) as RuntimePublicHttpRequestOptions;
  const contract = publicHttpContracts[name];
  if (runtimeOptions.body !== undefined && !("body" in contract.request)) {
    throw new TypeError(`Public HTTP contract ${name} does not accept a request body`);
  }
  if (runtimeOptions.body === undefined && "body" in contract.request) {
    throw new TypeError(`Public HTTP contract ${name} requires a request body`);
  }
  const path = runtimeOptions.parameters
    ? buildApiPath(contract.path, runtimeOptions.parameters)
    : contract.path;
  const query = new URLSearchParams(
    Object.entries(runtimeOptions.query ?? {}).map(([key, value]) => [key, String(value)]),
  );
  const headers = new Headers(runtimeOptions.headers);
  if (runtimeOptions.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  appendAuthorization(headers);
  // 开发环境可用 VITE_API_BASE_URL 直连本地 API；生产与 node 测试保持同源相对路径。
  const apiBaseUrl = resolveBrowserApiEndpoint();
  const requestUrl = query.size > 0 ? `${apiBaseUrl}${path}?${query}` : `${apiBaseUrl}${path}`;
  const response = await fetch(requestUrl, {
    method: contract.method,
    credentials: "omit",
    headers,
    ...(runtimeOptions.body === undefined ? {} : { body: JSON.stringify(runtimeOptions.body) }),
    ...(runtimeOptions.signal === undefined ? {} : { signal: runtimeOptions.signal }),
  });
  if (!response.ok) {
    if (!(response.status in contract.errors)) {
      throw new ApiError(
        response.status,
        "undeclared-http-error",
        `Public HTTP contract ${name} does not declare status ${response.status}`,
      );
    }
    const error = (await response.json().catch(() => undefined)) as
      | { error?: string; message?: string; details?: unknown }
      | undefined;
    // 401 判定规则见 isSessionExpiredResponse：登录凭据错误与主动 logout 不触发兜底。
    if (isSessionExpiredResponse(response.status, error?.error, name)) {
      handleSessionExpired();
    }
    throw new ApiError(
      response.status,
      error?.error ?? "request-failed",
      error?.message ?? `Request failed with status ${response.status}`,
      error && typeof error.details === "object" && error.details !== null
        ? (error.details as Record<string, unknown>)
        : undefined,
    );
  }
  if (response.status !== contract.success.status) {
    throw new TypeError(
      `Public HTTP contract ${name} does not declare success status ${response.status}`,
    );
  }
  return response;
}

function appendAuthorization(headers: Headers): void {
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
}

function handleSessionExpired(): void {
  clearAccessToken();
  sessionExpiredHandler?.();
}

export function createIdempotencyKey(prefix: string): string {
  return `${prefix}-${randomUuidV4()}`;
}

/**
 * UUID v4 生成。crypto.randomUUID 仅在 secure context（HTTPS 或 localhost）
 * 可用；IP 直连的 HTTP 部署下不存在，此时用 crypto.getRandomValues 构造
 * UUID v4（getRandomValues 不要求 secure context），保证命令操作在
 * 非 HTTPS 站点上也能生成幂等键。导出供各前端应用复用同一 fallback
 * （概览输入口、材料「用此材料生成」、任务创建、场景编辑器）。
 */
export function randomUuidV4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

