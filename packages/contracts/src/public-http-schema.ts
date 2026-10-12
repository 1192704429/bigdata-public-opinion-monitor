export type JsonSchema = Record<string, unknown>;
export type HttpMethod = "GET" | "POST" | "DELETE";

type JsonSchemaObject<Properties extends Record<string, unknown>, Required> = {
  -readonly [Key in keyof Properties as Key extends RequiredKey<Required>
    ? Key
    : never]-?: FromJsonSchema<Properties[Key]>;
} & {
  -readonly [Key in keyof Properties as Key extends RequiredKey<Required>
    ? never
    : Key]?: FromJsonSchema<Properties[Key]>;
};

type RequiredKey<Required> = Required extends readonly string[] ? Required[number] : never;

type FromJsonSchemaType<Type, Schema> = Type extends "string"
  ? string
  : Type extends "number" | "integer"
    ? number
    : Type extends "boolean"
      ? boolean
      : Type extends "null"
        ? null
        : Type extends "array"
          ? Schema extends { items: infer Item }
            ? Array<FromJsonSchema<Item>>
            : unknown[]
          : Type extends "object"
            ? Schema extends {
                properties: infer Properties extends Record<string, unknown>;
                required?: infer Required;
              }
              ? JsonSchemaObject<Properties, Required>
              : Schema extends { additionalProperties: infer Additional }
                ? Additional extends true
                  ? Record<string, unknown>
                  : Additional extends Record<string, unknown>
                    ? Record<string, FromJsonSchema<Additional>>
                    : Record<string, never>
                : Record<string, unknown>
            : unknown;

/** operation 的编译时 interface 直接由同一份运行时 JSON Schema 推导。 */
export type FromJsonSchema<Schema> = Schema extends { const: infer Constant }
  ? Constant
  : Schema extends { enum: readonly (infer Item)[] }
    ? Item
    : Schema extends { oneOf: readonly (infer Variant)[] }
      ? FromJsonSchema<Variant>
      : Schema extends { anyOf: readonly (infer Variant)[] }
        ? FromJsonSchema<Variant>
        : Schema extends { type: infer Type }
          ? Type extends readonly unknown[]
            ? FromJsonSchemaType<Type[number], Schema>
            : FromJsonSchemaType<Type, Schema>
          : unknown;

export interface PublicHttpRequestSchema {
  body?: JsonSchema;
  headers?: JsonSchema;
  params?: JsonSchema;
  querystring?: JsonSchema;
}

export type PublicHttpRuntimeContract<
  Method extends HttpMethod = HttpMethod,
  Path extends string = string,
  Request extends PublicHttpRequestSchema = PublicHttpRequestSchema,
  Status extends number = number,
  Body extends
    | { kind: "json"; schema: JsonSchema }
    | { kind: "empty" }
    | { kind: "binary" }
    | { kind: "stream" } =
    | { kind: "json"; schema: JsonSchema }
    | { kind: "empty" }
    | { kind: "binary" }
    | { kind: "stream" },
> = {
  method: Method;
  path: Path;
  request: Request;
  success: { status: Status; body: Body };
  errors: Record<number, JsonSchema>;
};

export type PublicHttpContract = PublicHttpRuntimeContract;

export const stringSchema = { type: "string" } as const;
export const uuidSchema = { type: "string", format: "uuid" } as const;
/** 管理端与 Agent 共用的不透明 keyset 分页参数。 */
export const pageQueryProperties = {
  limit: { type: "integer", minimum: 1, maximum: 500 },
  cursor: { type: "string", minLength: 1, maxLength: 512 },
} as const;
export const loginNameSchema = { type: "string", minLength: 1, maxLength: 100 } as const;
export const passwordSchema = { type: "string", minLength: 1, maxLength: 200 } as const;
export const displayNameSchema = { type: "string", minLength: 1, maxLength: 200 } as const;
export const titleSchema = { type: "string", minLength: 1, maxLength: 200 } as const;
export const fileNameSchema = { type: "string", minLength: 1, maxLength: 255 } as const;
export const mediaTypeSchema = { type: "string", minLength: 1, maxLength: 100 } as const;
export const checksumSchema = { type: "string", pattern: "^[a-f0-9]{64}$" } as const;
export const streamAssetSchema = {
  type: "string",
  pattern: "^(index\\.m3u8|segment-[0-9]{3,}\\.ts)$",
} as const;
export const publicObjectSchema = { type: "object", additionalProperties: true } as const;
export const errorResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["error", "message"],
  properties: {
    error: stringSchema,
    message: stringSchema,
    details: { type: "object", additionalProperties: true },
  },
} as const;
export const standardErrors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  500: errorResponseSchema,
  // 反向代理在 API 不可达时可能返回 502，浏览器 adapter 仍需按标准错误处理。
  502: errorResponseSchema,
} as const;

export function objectSchema<
  const Required extends readonly string[],
  const Properties extends Record<string, JsonSchema>,
>(
  required: Required,
  properties: Properties,
): {
  readonly type: "object";
  readonly additionalProperties: false;
  readonly required: Required;
  readonly properties: Properties;
} {
  return { type: "object", additionalProperties: false, required, properties };
}

type JsonOperationContract<
  Method extends HttpMethod,
  Path extends string,
  Status extends number,
  Request extends PublicHttpRequestSchema,
  Response extends JsonSchema,
> = PublicHttpRuntimeContract<
  Method,
  Path,
  Request,
  Status,
  Status extends 204 ? { kind: "empty" } : { kind: "json"; schema: Response }
>;

export function operation<
  const Method extends HttpMethod,
  const Path extends string,
  const Status extends number,
>(
  method: Method,
  path: Path,
  successStatus: Status,
): JsonOperationContract<Method, Path, Status, Record<never, never>, typeof publicObjectSchema>;
export function operation<
  const Method extends HttpMethod,
  const Path extends string,
  const Status extends number,
  const Request extends PublicHttpRequestSchema,
>(
  method: Method,
  path: Path,
  successStatus: Status,
  request: Request,
): JsonOperationContract<Method, Path, Status, Request, typeof publicObjectSchema>;
export function operation<
  const Method extends HttpMethod,
  const Path extends string,
  const Status extends number,
  const Request extends PublicHttpRequestSchema,
  const Response extends JsonSchema,
>(
  method: Method,
  path: Path,
  successStatus: Status,
  request: Request,
  response: Response,
): JsonOperationContract<Method, Path, Status, Request, Response>;
export function operation(
  method: HttpMethod,
  path: string,
  successStatus: number,
  request: PublicHttpRequestSchema = {},
  response: JsonSchema = publicObjectSchema,
): PublicHttpContract {
  return {
    method,
    path,
    request,
    success:
      successStatus === 204
        ? { status: successStatus, body: { kind: "empty" } }
        : { status: successStatus, body: { kind: "json", schema: response } },
    errors: standardErrors,
  };
}

export function binaryOperation<
  const Method extends HttpMethod,
  const Path extends string,
  const Status extends number,
>(
  method: Method,
  path: Path,
  successStatus: Status,
): PublicHttpRuntimeContract<Method, Path, Record<never, never>, Status, { kind: "binary" }>;
export function binaryOperation<
  const Method extends HttpMethod,
  const Path extends string,
  const Status extends number,
  const Request extends PublicHttpRequestSchema,
>(
  method: Method,
  path: Path,
  successStatus: Status,
  request: Request,
): PublicHttpRuntimeContract<Method, Path, Request, Status, { kind: "binary" }>;
export function binaryOperation(
  method: HttpMethod,
  path: string,
  successStatus: number,
  request: PublicHttpRequestSchema = {},
): PublicHttpContract {
  return {
    method,
    path,
    request,
    success: { status: successStatus, body: { kind: "binary" } },
    errors: standardErrors,
  };
}

export function streamOperation<
  const Method extends HttpMethod,
  const Path extends string,
  const Status extends number,
  const Request extends PublicHttpRequestSchema,
>(
  method: Method,
  path: Path,
  successStatus: Status,
  request: Request,
): PublicHttpRuntimeContract<Method, Path, Request, Status, { kind: "stream" }> {
  return {
    method,
    path,
    request,
    success: { status: successStatus, body: { kind: "stream" } },
    errors: standardErrors,
  };
}

export function emptyOperation<
  const Method extends HttpMethod,
  const Path extends string,
  const Status extends number,
>(
  method: Method,
  path: Path,
  successStatus: Status,
): PublicHttpRuntimeContract<Method, Path, Record<never, never>, Status, { kind: "empty" }>;
export function emptyOperation<
  const Method extends HttpMethod,
  const Path extends string,
  const Status extends number,
  const Request extends PublicHttpRequestSchema,
>(
  method: Method,
  path: Path,
  successStatus: Status,
  request: Request,
): PublicHttpRuntimeContract<Method, Path, Request, Status, { kind: "empty" }>;
export function emptyOperation(
  method: HttpMethod,
  path: string,
  successStatus: number,
  request: PublicHttpRequestSchema = {},
): PublicHttpContract {
  return {
    method,
    path,
    request,
    success: { status: successStatus, body: { kind: "empty" } },
    errors: standardErrors,
  };
}
