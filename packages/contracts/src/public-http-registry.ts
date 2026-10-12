import { identityHttpContracts } from "./public-http-registries/identity";
import { sentimentHttpContracts } from "./public-http-registries/sentiment";

import type { PublicHttpContract } from "./public-http-schema";

/** 所有公开 HTTP operation 的唯一 registry；领域模块只在各自文件中定义一次。 */
export const publicHttpContracts = {
  ...identityHttpContracts,
  ...sentimentHttpContracts,
} satisfies Record<string, PublicHttpContract>;
