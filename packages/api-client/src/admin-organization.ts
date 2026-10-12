import type {
  ManagedAccount,
  PublicHttpOperationResponse,
} from "@aicp/contracts";

import { createIdempotencyKey, requestOperation } from "./common";

export interface AccountDirectorySummary {
  totalCount: number;
  disabledCount: number;
}

export type AccountPage = PublicHttpOperationResponse<"listAccounts">;

export async function queryAccounts(input?: {
  search?: string;
  disabled?: boolean;
  limit?: number;
  cursor?: string;
}): Promise<AccountPage> {
  return requestOperation(
    "listAccounts",
    input && Object.keys(input).length > 0 ? { query: input } : {},
  );
}

export async function createAccount(input: {
  loginName: string;
  displayName: string;
  initialPassword: string;
}): Promise<ManagedAccount> {
  return (
    await requestOperation("createAccount", {
      headers: commandHeaders("create-account"),
      body: input,
    })
  ).account;
}

export async function updateAccountStatus(
  accountId: string,
  input: { disabled: boolean },
): Promise<ManagedAccount> {
  return (
    await requestOperation("updateAccountStatus", {
      parameters: { accountId },
      headers: commandHeaders("update-account-status"),
      body: input,
    })
  ).account;
}

function commandHeaders(action: string): HeadersInit {
  return {
    "content-type": "application/json",
    "idempotency-key": createIdempotencyKey(action),
  };
}
