import {
  displayNameSchema,
  loginNameSchema,
  objectSchema,
  pageQueryProperties,
  stringSchema,
} from "./public-http-schema";

export const managedAccountSchema = objectSchema(
  ["id", "loginName", "displayName", "disabled", "mustChangePassword"],
  {
    id: { type: "string" },
    loginName: loginNameSchema,
    displayName: displayNameSchema,
    disabled: { type: "boolean" },
    mustChangePassword: { type: "boolean" },
  },
);

export const accountSummarySchema = objectSchema(["totalCount", "disabledCount"], {
  totalCount: { type: "integer", minimum: 0 },
  disabledCount: { type: "integer", minimum: 0 },
});

export const accountPageSchema = objectSchema(["accounts", "summary", "hasMore"], {
  accounts: { type: "array", items: managedAccountSchema },
  summary: accountSummarySchema,
  hasMore: { type: "boolean" },
  nextCursor: stringSchema,
});

export const createAccountRequestSchema = objectSchema(
  ["loginName", "displayName", "initialPassword"],
  {
    loginName: loginNameSchema,
    displayName: displayNameSchema,
    initialPassword: { type: "string", minLength: 1, maxLength: 200 },
  },
);

export const loginResponseSchema = objectSchema(["token", "account"], {
  token: { type: "string", minLength: 1, maxLength: 512 },
  account: objectSchema(["loginName", "mustChangePassword"], {
    loginName: loginNameSchema,
    mustChangePassword: { type: "boolean" },
  }),
});
