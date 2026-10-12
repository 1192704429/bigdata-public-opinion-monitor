import {
  loginNameSchema,
  objectSchema,
  operation,
  pageQueryProperties,
  passwordSchema,
} from "../public-http-schema";
import {
  accountPageSchema,
  createAccountRequestSchema,
  loginResponseSchema,
  managedAccountSchema,
} from "../identity-http-schemas";

/** 单租户认证契约：登录只提交账号和密码，不再通过请求头选择租户。 */
export const identityHttpContracts = {
  login: operation(
    "POST",
    "/api/auth/login",
    200,
    {
      body: objectSchema(["loginName", "password"], {
        loginName: loginNameSchema,
        password: { type: "string", minLength: 1, maxLength: 200 },
      }),
    },
    loginResponseSchema,
  ),
  logout: operation("POST", "/api/auth/logout", 204),
  changePassword: operation("POST", "/api/auth/password", 204, {
    body: objectSchema(["currentPassword", "newPassword"], {
      currentPassword: { type: "string", minLength: 1, maxLength: 200 },
      newPassword: passwordSchema,
    }),
  }),
  listAccounts: operation(
    "GET",
    "/api/admin/accounts",
    200,
    {
      querystring: objectSchema([], {
        search: { type: "string", maxLength: 100 },
        disabled: { type: "boolean" },
        ...pageQueryProperties,
      }),
    },
    accountPageSchema,
  ),
  createAccount: operation(
    "POST",
    "/api/admin/accounts",
    201,
    { body: createAccountRequestSchema },
    objectSchema(["account"], { account: managedAccountSchema }),
  ),
  updateAccountStatus: operation(
    "POST",
    "/api/admin/accounts/:accountId/status",
    200,
    {
      params: objectSchema(["accountId"], { accountId: { type: "string", minLength: 1, maxLength: 100 } }),
      body: objectSchema(["disabled"], { disabled: { type: "boolean" } }),
    },
    objectSchema(["account"], { account: managedAccountSchema }),
  ),
} as const;
