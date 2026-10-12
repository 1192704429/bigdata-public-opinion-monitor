export interface BrowserEndpointEnvironment {
  readonly VITE_API_BASE_URL?: string;
}

export interface ViteProxyEnvironment {
  readonly AICP_API_PROXY_URL?: string;
}

export const DEFAULT_LOCAL_API_BASE_URL = "http://127.0.0.1:3100";

/**
 * 浏览器请求的唯一端点 seam：未配置时返回空字符串，让生产请求保持同源相对路径。
 * 本地或浏览器验收通过 VITE_API_BASE_URL 注入 API origin，避免把环境判断散落在每个请求。
 */
export function resolveBrowserApiEndpoint(
  environment: BrowserEndpointEnvironment = readViteEnvironment(),
): string {
  const endpoint = normalizeEndpoint(environment.VITE_API_BASE_URL, "VITE_API_BASE_URL");
  if (!endpoint || typeof window === "undefined") return endpoint;

  // 本地开发经常会混用 localhost 和 127.0.0.1。API 端口仍以配置为准，
  // 仅让回环地址跟随当前页面主机名，减少本地 CORS 来源配置的歧义；Bearer token
  // 不依赖浏览器凭证的跨主机携带规则。
  const pageHost = window.location.hostname;
  const apiUrl = new URL(endpoint);
  if (isLoopbackHost(apiUrl.hostname) && pageHost) {
    apiUrl.hostname = pageHost;
    return apiUrl.href.replace(/\/+$/, "");
  }
  return endpoint;
}

/** Vite server.proxy 只在开发进程中使用，和浏览器 bundle 的 endpoint 解析共享校验规则。 */
export function resolveViteProxyTarget(environment: ViteProxyEnvironment): string {
  return (
    normalizeEndpoint(environment.AICP_API_PROXY_URL, "AICP_API_PROXY_URL") ||
    DEFAULT_LOCAL_API_BASE_URL
  );
}

function readViteEnvironment(): BrowserEndpointEnvironment {
  return (import.meta as ImportMeta & { env?: BrowserEndpointEnvironment }).env ?? {};
}

function normalizeEndpoint(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  let endpoint: URL;
  try {
    endpoint = new URL(trimmed);
  } catch {
    throw new Error(`${name} must be an absolute http(s) URL`);
  }
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new Error(`${name} must use http:// or https://`);
  }
  if (endpoint.username || endpoint.password) {
    throw new Error(`${name} must not include credentials`);
  }
  if (endpoint.search || endpoint.hash) {
    throw new Error(`${name} must not include a query string or hash`);
  }
  return endpoint.href.replace(/\/+$/, "");
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}
