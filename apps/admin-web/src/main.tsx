import "@fontsource-variable/manrope";
import "@fontsource-variable/noto-sans-sc";
import "@fontsource/ibm-plex-mono/500.css";
import { setAccessToken, setSessionExpiredHandler } from "@aicp/api-client/common";
import { createBrowserSession, createSessionExpiredHandler } from "@aicp/auth";
import "@aicp/design-tokens/tokens.css";
import { EmptyStateIcon } from "@aicp/ui";
import "./theme/admin-tokens.css";
import { adminAntdTheme } from "./theme/admin-antd-theme";
import "./styles.css";

import { ConfigProvider, App as AntApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import { App } from "./App";
import { portal, SINGLE_TENANT_SLUG } from "./routes";

// antd 的 zhCN 只覆盖组件文案；DatePicker 面板的月份/星期仍走 dayjs locale，
// 需注册 zh-cn 才能与全站中文一致。
dayjs.locale("zh-cn");

// API client 只报告服务端会话失效；清理快照和恢复登录路径由共享 browser-session module 统一处理。
const browserSession = createBrowserSession(portal);
setAccessToken(browserSession.load(SINGLE_TENANT_SLUG)?.token);
setSessionExpiredHandler(createSessionExpiredHandler(browserSession));

const root = document.getElementById("root");
if (!root) {
  throw new Error("Admin application root was not found");
}

createRoot(root).render(
  <StrictMode>
    {/* empty.image 全局替换 antd 默认空状态图；styles.image 固定容器高度
        适配 48px 小图标，避免 v6 按 controlHeightLG×2.5 计算的高度撑开布局 */}
    <ConfigProvider
      locale={zhCN}
      theme={adminAntdTheme}
      empty={{ image: <EmptyStateIcon />, styles: { image: { height: 48 } } }}
    >
      <AntApp>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);
