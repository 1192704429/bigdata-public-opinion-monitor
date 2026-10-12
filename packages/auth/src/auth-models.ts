import type { LoginResponse } from "@aicp/contracts";

/** 浏览器保存的登录快照；token 会随请求放入 Authorization 头。 */
export interface ClientSession {
  token: string;
  account: LoginResponse["account"];
}
