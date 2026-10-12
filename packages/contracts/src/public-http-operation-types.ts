import type { publicHttpContracts } from "./public-http-registry";
import type { FromJsonSchema } from "./public-http-schema";

type RuntimeContracts = typeof publicHttpContracts;
type RuntimeContractName = keyof RuntimeContracts;
type RuntimeRequest<Name extends RuntimeContractName> = RuntimeContracts[Name]["request"];
type RuntimeSuccess<Name extends RuntimeContractName> = RuntimeContracts[Name]["success"]["body"];

type SchemaField<
  Name extends RuntimeContractName,
  Field extends "body" | "params" | "querystring",
> = Field extends keyof RuntimeRequest<Name>
  ? RuntimeRequest<Name>[Field] extends infer Schema
    ? FromJsonSchema<Schema>
    : never
  : never;

type RuntimeResponse<Name extends RuntimeContractName> =
  RuntimeSuccess<Name> extends { kind: "json"; schema: infer Schema }
    ? FromJsonSchema<Schema>
    : RuntimeSuccess<Name> extends { kind: "empty" }
      ? void
      : RuntimeSuccess<Name> extends { kind: "binary" }
        ? Blob
        : RuntimeSuccess<Name> extends { kind: "stream" }
          ? Response
          : never;

/**
 * 操作名是公开 HTTP module 的唯一 seam；请求字段、响应 kind 与返回类型都由同一 registry 键绑定。
 * 浏览器 adapter 不能再自行声明一个与运行时 contract 无关的泛型返回值。
 */
export type PublicHttpOperationMap = {
  [Name in RuntimeContractName]: {
    parameters: SchemaField<Name, "params">;
    query: SchemaField<Name, "querystring">;
    body: SchemaField<Name, "body">;
    responseKind: RuntimeSuccess<Name>["kind"];
    response: RuntimeResponse<Name>;
  };
};

export type PublicHttpContractName = keyof PublicHttpOperationMap;

export type PublicHttpJsonOperationName = {
  [Name in PublicHttpContractName]: PublicHttpOperationMap[Name]["responseKind"] extends "json"
    ? Name
    : never;
}[PublicHttpContractName];

export type PublicHttpEmptyOperationName = {
  [Name in PublicHttpContractName]: PublicHttpOperationMap[Name]["responseKind"] extends "empty"
    ? Name
    : never;
}[PublicHttpContractName];

export type PublicHttpBinaryOperationName = {
  [Name in PublicHttpContractName]: PublicHttpOperationMap[Name]["responseKind"] extends "binary"
    ? Name
    : never;
}[PublicHttpContractName];

export type PublicHttpStreamOperationName = {
  [Name in PublicHttpContractName]: PublicHttpOperationMap[Name]["responseKind"] extends "stream"
    ? Name
    : never;
}[PublicHttpContractName];

export type PublicHttpOperationResponse<Name extends PublicHttpContractName> =
  PublicHttpOperationMap[Name]["response"];

/** Fastify 等服务端 adapter 直接消费 operation 名，不再手写 Body/Params/Querystring DTO。 */
export type PublicHttpServerRoute<Name extends PublicHttpContractName> = OptionFor<
  "Params",
  PublicHttpOperationMap[Name]["parameters"]
> &
  OptionFor<"Querystring", PublicHttpOperationMap[Name]["query"]> &
  OptionFor<"Body", PublicHttpOperationMap[Name]["body"]>;

type OptionFor<Field extends string, Value> = [Value] extends [never]
  ? Record<never, never>
  : { [Key in Field]: Value };

type QueryOption<Value> = [Value] extends [never]
  ? Record<never, never>
  : Record<never, never> extends Value
    ? { query?: Value }
    : { query: Value };

export type PublicHttpRequestOptions<Name extends PublicHttpContractName> = OptionFor<
  "parameters",
  PublicHttpOperationMap[Name]["parameters"]
> &
  QueryOption<PublicHttpOperationMap[Name]["query"]> &
  OptionFor<"body", PublicHttpOperationMap[Name]["body"]> & {
    headers?: HeadersInit;
    /** 请求取消信号（流式接口），供「停止生成」等交互中止 fetch。 */
    signal?: AbortSignal;
  };

export type PublicHttpRequestArguments<Name extends PublicHttpContractName> =
  Record<never, never> extends PublicHttpRequestOptions<Name>
    ? [options?: PublicHttpRequestOptions<Name>]
    : [options: PublicHttpRequestOptions<Name>];
