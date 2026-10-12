import { createPortalRouting } from "@aicp/auth/portal-routing";

// 会话键、角色守卫与失效跳转统一由共享 portal module 提供，应用入口只维护一套系统路由。
export const portal = createPortalRouting("admin");
import {
  Bot,
  Database,
  Globe,
  LayoutDashboard,
  ListTodo,
  Radio,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

/** 单租户固定标识仅用于兼容旧会话键和页面组件参数，不参与 URL 路由。 */
export const SINGLE_TENANT_SLUG = "default";
export const publicLoginPath = portal.publicLoginPath;

export type RouteId =
  | "login"
  | "change-password"
  | "accounts"
  | "sentiment"
  | "opinion"
  | "opinion-articles"
  | "opinion-alerts"
  | "opinion-sources"
  | "opinion-tasks"
  | "opinion-ai-models";

export type RouteAccess = "public" | "password-change" | "protected";

export interface RouteDefinition {
  id: RouteId;
  path: string;
  access: RouteAccess;
  navigation?: {
    /** 侧边栏分组：舆情业务 / 舆情配置 / 系统管理（菜单顺序即 routeConfig 数组顺序）。 */
    group: "core" | "content" | "governance";
    label: string;
    icon: LucideIcon;
  };
}

export const routeConfig: readonly RouteDefinition[] = [
  { id: "login", path: "login", access: "public" },
  { id: "change-password", path: "change-password", access: "password-change" },
  {
    id: "opinion",
    path: "opinion",
    access: "protected",
    navigation: { group: "core", label: "首页", icon: LayoutDashboard },
  },
  {
    id: "sentiment",
    path: "sentiment",
    access: "protected",
    navigation: { group: "core", label: "舆情监测", icon: Radio },
  },
  {
    id: "opinion-articles",
    path: "opinion-articles",
    access: "protected",
    navigation: { group: "core", label: "舆情数据管理", icon: Database },
  },
  {
    id: "opinion-alerts",
    path: "opinion-alerts",
    access: "protected",
    navigation: { group: "core", label: "舆情预警管理", icon: TriangleAlert },
  },
  {
    id: "opinion-sources",
    path: "opinion-sources",
    access: "protected",
    navigation: { group: "content", label: "数据源管理", icon: Globe },
  },
  {
    id: "opinion-tasks",
    path: "opinion-tasks",
    access: "protected",
    navigation: { group: "content", label: "采集任务", icon: ListTodo },
  },
  {
    id: "opinion-ai-models",
    path: "opinion-ai-models",
    access: "protected",
    navigation: { group: "content", label: "AI 模型配置", icon: Bot },
  },
  {
    id: "accounts",
    path: "accounts",
    access: "protected",
    navigation: { group: "governance", label: "用户管理", icon: ShieldCheck },
  },
];

export const navigationRoutes = routeConfig.filter(
  (route): route is RouteDefinition & { navigation: NonNullable<RouteDefinition["navigation"]> } =>
    route.navigation !== undefined,
);

// portal 实例方法经箭头包装后导出，避免未绑定方法丢失 this 上下文。
export const hasRoutePermission = (
  ...args: Parameters<typeof portal.hasRoutePermission>
): ReturnType<typeof portal.hasRoutePermission> => portal.hasRoutePermission(...args);
export const resolveTenantSlug = (
  ...args: Parameters<typeof portal.resolveTenantSlug>
): ReturnType<typeof portal.resolveTenantSlug> => portal.resolveTenantSlug(...args);
export const sessionKey = (
  ...args: Parameters<typeof portal.sessionKey>
): ReturnType<typeof portal.sessionKey> => portal.sessionKey(...args);

/** 从 routeConfig 派生的单租户路径投影：所有业务页面统一挂在 /admin 下。 */
export function opinionTaskDetailPath(taskId: number | string, recordId?: number | string): string {
  const base = `${paths().opinionTasks}/${taskId}`;
  return recordId === undefined ? base : `${base}?recordId=${recordId}`;
}

export function paths(_tenantSlug: string = SINGLE_TENANT_SLUG): {
  root: string;
  login: string;
  changePassword: string;
  accounts: string;
  sentiment: string;
  opinion: string;
  opinionArticles: string;
  opinionAlerts: string;
  opinionSources: string;
  opinionTasks: string;
  opinionAiModels: string;
} {
  const root = portal.rootFor(SINGLE_TENANT_SLUG);
  const byId = Object.fromEntries(
    routeConfig.map((route) => [route.id, `${root}/${route.path}`]),
  ) as Record<RouteId, string>;
  return {
    root,
    login: byId.login,
    changePassword: byId["change-password"],
    accounts: byId.accounts,
    sentiment: byId.sentiment,
    opinion: byId.opinion,
    opinionArticles: byId["opinion-articles"],
    opinionAlerts: byId["opinion-alerts"],
    opinionSources: byId["opinion-sources"],
    opinionTasks: byId["opinion-tasks"],
    opinionAiModels: byId["opinion-ai-models"],
  };
}
