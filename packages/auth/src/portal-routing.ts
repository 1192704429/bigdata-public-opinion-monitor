import type { ClientSession } from "./auth-models";

/** 舆情管理端只有一个固定入口。 */
export type PortalName = "admin";

export interface PortalRouteGuard {
  protected?: boolean;
}

export interface SessionStorage {
  removeItem(key: string): void;
  [key: string]: unknown;
}

/**
 * 单租户路由与会话规则：不再解析 URL 中的租户 slug，也不再按租户创建多份本地会话。
 * 保留旧方法签名是为了让历史页面组件平滑升级，传入的 slug 会被忽略。
 */
export interface PortalRouting {
  portal: PortalName;
  publicLoginPath: string;
  resolveTenantSlug(pathname: string): string | undefined;
  sessionKey(tenantSlug?: string): string;
  purgeSessions(storage: SessionStorage): void;
  sessionExpiredUrl(pathname: string): string;
  sessionExpiredNotice(): string | undefined;
  hasRoutePermission(route: PortalRouteGuard, session: ClientSession): boolean;
  rootFor(tenantSlug?: string): string;
}

export function createPortalRouting(portal: PortalName): PortalRouting {
  const portalSegment = portal;
  const stableSessionKey = "aicp-admin-session";
  const publicLoginPath = `/${portalSegment}/login`;

  return {
    portal,
    publicLoginPath,
    resolveTenantSlug(_pathname: string): string | undefined {
      return undefined;
    },
    sessionKey(_tenantSlug?: string): string {
      return stableSessionKey;
    },
    purgeSessions(storage: SessionStorage): void {
      for (const key of Object.keys(storage)) {
        if (key === stableSessionKey || key.startsWith(`${stableSessionKey}:`)) {
          storage.removeItem(key);
        }
      }
    },
    sessionExpiredUrl(_pathname: string): string {
      return `${publicLoginPath}?reason=session-expired`;
    },
    sessionExpiredNotice(): string | undefined {
      if (typeof window === "undefined") return undefined;
      return new URLSearchParams(window.location.search).get("reason") === "session-expired"
        ? "登录已过期，请重新登录"
        : undefined;
    },
    hasRoutePermission(_route: PortalRouteGuard, _session: ClientSession): boolean {
      return true;
    },
    rootFor(_tenantSlug?: string): string {
      return `/${portalSegment}`;
    },
  };
}
