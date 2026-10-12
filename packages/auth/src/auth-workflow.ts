import type { LoginResponse } from "@aicp/contracts";

import type { ClientSession } from "./auth-models";

export type AuthPortal = "admin";

export interface AuthClient {
  login(input: { loginName: string; password: string }): Promise<LoginResponse>;
  changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
}

export interface LoginWorkflowInput {
  tenantSlug?: string;
  loginName: string;
  password: string;
}

export type LoginWorkflowResult =
  | { kind: "authenticated"; tenantSlug: string; session: ClientSession }
  | { kind: "invalid-input"; field: "tenantSlug" | "loginName" | "password"; message: string }
  | { kind: "access-denied"; message: string }
  | { kind: "error"; message: string };

export interface PasswordChangeWorkflowInput {
  currentPassword: string;
  newPassword: string;
  confirmation: string;
}

export type PasswordChangeWorkflowResult =
  | { kind: "changed" }
  | {
      kind: "invalid-input";
      field: "currentPassword" | "newPassword" | "confirmation";
      message: string;
    }
  | { kind: "error"; message: string };

/**
 * 登录 workflow module：统一单租户归一化、角色准入和错误结果，
 * portal 只注入自己的 HTTP adapter 与呈现 view。
 */
export async function runLoginWorkflow(
  input: LoginWorkflowInput,
  options: { portal: AuthPortal; tenantSlug?: string; client: AuthClient },
): Promise<LoginWorkflowResult> {
  // 系统只有一个固定工作区；保留固定值只是为了兼容旧的 portal workflow 类型。
  const tenantSlug = (options.tenantSlug ?? input.tenantSlug ?? "default").trim().toLowerCase() || "default";
  if (!input.loginName.trim()) {
    return { kind: "invalid-input", field: "loginName", message: "请输入登录名" };
  }
  if (!input.password) {
    return { kind: "invalid-input", field: "password", message: "请输入密码" };
  }

  try {
    const response = await options.client.login({
      loginName: input.loginName,
      password: input.password,
    });
    return { kind: "authenticated", tenantSlug, session: response };
  } catch (caught) {
    return {
      kind: "error",
      message: errorMessage(caught, "登录服务暂时不可用，请稍后重试。", {
        "invalid-credentials": "登录名或密码错误",
        validation: "登录信息校验失败，请检查后重试。",
      }),
    };
  }
}

/** 主动修改密码 workflow；当前版本不强制首次登录改密。 */
export async function runPasswordChangeWorkflow(
  input: PasswordChangeWorkflowInput,
  client: AuthClient,
): Promise<PasswordChangeWorkflowResult> {
  if (!input.currentPassword) {
    return { kind: "invalid-input", field: "currentPassword", message: "请输入当前密码" };
  }
  if (!input.newPassword) {
    return { kind: "invalid-input", field: "newPassword", message: "请输入新密码" };
  }
  if (input.newPassword !== input.confirmation) {
    return {
      kind: "invalid-input",
      field: "confirmation",
      message: "两次输入的个人密码不一致",
    };
  }

  try {
    await client.changePassword({
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    });
    return { kind: "changed" };
  } catch (caught) {
    return {
      kind: "error",
      message: errorMessage(caught, "密码修改暂时不可用，请稍后重试。", {
        "invalid-credentials": "当前密码错误",
        validation: "密码信息校验失败，请检查后重试。",
      }),
    };
  }
}

/**
 * 认证错误只能按稳定的公开 code 映射产品文案；供应商、数据库和网关的 message
 * 可能包含凭据、地址或内部实现细节，不能直接呈现给用户。
 */
function errorMessage(
  caught: unknown,
  fallback: string,
  messages: Partial<Record<"invalid-credentials" | "validation", string>>,
): string {
  const code = readErrorCode(caught);
  return code ? (messages[code] ?? fallback) : fallback;
}

function readErrorCode(caught: unknown): "invalid-credentials" | "validation" | undefined {
  if (!isRecord(caught)) return undefined;
  const code = caught.code;
  return code === "invalid-credentials" || code === "validation" ? code : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
