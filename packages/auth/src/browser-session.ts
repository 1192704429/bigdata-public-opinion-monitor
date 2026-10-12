import type { ClientSession } from "./auth-models";
import type { PortalRouting, SessionStorage } from "./portal-routing";

export interface BrowserSessionStorage extends SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BrowserSession {
  load(tenantSlug: string): ClientSession | undefined;
  save(tenantSlug: string, session: ClientSession): void;
  clear(tenantSlug: string): void;
  purge(): void;
  expiredUrl(pathname: string): string;
}

/**
 * 浏览器会话消费 deep module：把 token 与本地元数据、
 * 失效清理与登录页恢复路径放在同一个 seam。存储和导航可替换，测试不需要真实浏览器。
 */
export function createBrowserSession(
  portal: PortalRouting,
  providedStorage?: BrowserSessionStorage,
): BrowserSession {
  let storage = providedStorage;

  function currentStorage(): BrowserSessionStorage {
    storage ??= browserStorage();
    return storage;
  }

  return {
    load(tenantSlug: string): ClientSession | undefined {
      const current = currentStorage();
      const raw = current.getItem(portal.sessionKey(tenantSlug));
      if (!raw) return undefined;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isClientSession(parsed)) {
          current.removeItem(portal.sessionKey(tenantSlug));
          return undefined;
        }
        return parsed;
      } catch {
        current.removeItem(portal.sessionKey(tenantSlug));
        return undefined;
      }
    },
    save(tenantSlug: string, session: ClientSession): void {
      currentStorage().setItem(portal.sessionKey(tenantSlug), JSON.stringify(session));
    },
    clear(tenantSlug: string): void {
      currentStorage().removeItem(portal.sessionKey(tenantSlug));
    },
    purge(): void {
      portal.purgeSessions(currentStorage());
    },
    expiredUrl(pathname: string): string {
      return portal.sessionExpiredUrl(pathname);
    },
  };
}

/**
 * API client 发现服务端 token 失效后调用的恢复 adapter。
 * 先清除所有本 portal 的快照，再跳转，避免过期元数据继续驱动路由守卫。
 */
export function createSessionExpiredHandler(
  session: BrowserSession,
  options: {
    getPathname?: () => string;
    redirect?: (url: string) => void;
  } = {},
): () => void {
  return () => {
    session.purge();
    const pathname =
      options.getPathname?.() ?? (typeof window === "undefined" ? "/" : window.location.pathname);
    const url = session.expiredUrl(pathname);
    if (options.redirect) {
      options.redirect(url);
    } else if (typeof window !== "undefined") {
      window.location.assign(url);
    }
  };
}

function browserStorage(): BrowserSessionStorage {
  if (typeof window === "undefined") {
    throw new Error("Browser session storage is unavailable outside a browser");
  }
  return window.localStorage;
}

function isClientSession(value: unknown): value is ClientSession {
  if (!isRecord(value) || !isRecord(value.account)) return false;
  if (
    typeof value.token !== "string" ||
    value.token.trim().length === 0 ||
    typeof value.account.loginName !== "string" ||
    typeof value.account.mustChangePassword !== "boolean"
  ) {
    return false;
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
