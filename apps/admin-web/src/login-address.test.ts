import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveBrowserApiEndpoint } from "@aicp/api-client/browser-endpoint";

import {
  hasRoutePermission,
  paths,
  publicLoginPath,
  routeConfig,
  sessionKey,
} from "./routes";

void test("本地 API 地址跟随页面主机名，保持 Bearer token 请求来源一致", () => {
  const globalWithWindow = globalThis as typeof globalThis & {
    window?: { location: { hostname: string } };
  };
  const previousWindow = globalWithWindow.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { hostname: "localhost" } },
  });

  try {
    assert.equal(
      resolveBrowserApiEndpoint({ VITE_API_BASE_URL: "http://127.0.0.1:8181" }),
      "http://localhost:8181",
    );
  } finally {
    if (previousWindow === undefined) {
      Reflect.deleteProperty(globalWithWindow, "window");
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
    }
  }
});

void test("管理端使用固定单租户路由和会话键", () => {
  assert.equal(publicLoginPath, "/admin/login");
  assert.deepEqual(paths("acme"), {
    root: "/admin",
    login: "/admin/login",
    changePassword: "/admin/change-password",
    accounts: "/admin/accounts",
    sentiment: "/admin/sentiment",
    opinion: "/admin/opinion",
    opinionArticles: "/admin/opinion-articles",
    opinionAlerts: "/admin/opinion-alerts",
    opinionSources: "/admin/opinion-sources",
    opinionTasks: "/admin/opinion-tasks",
    opinionAiModels: "/admin/opinion-ai-models",
  });
  assert.equal(sessionKey("acme"), "aicp-admin-session");
});

void test("登录用户可访问所有受保护路由", () => {
  const session = {
    token: "test-token",
    account: { loginName: "admin", mustChangePassword: false },
  };
  for (const route of routeConfig.filter((item) => item.access === "protected")) {
    assert.equal(hasRoutePermission(route, session), true);
  }
});

void test("导航包含舆情业务和用户管理", () => {
  assert.deepEqual(
    routeConfig.map((route) => route.navigation?.label).filter(Boolean),
    ["首页", "舆情监测", "舆情数据管理", "舆情预警管理", "数据源管理", "采集任务", "AI 模型配置", "用户管理"],
  );
  assert.equal(routeConfig.some((route) => route.navigation?.label === "组织管理"), false);
  assert.equal(routeConfig.some((route) => route.navigation?.label === "分析任务"), false);
});
