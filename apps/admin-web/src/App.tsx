import { type ReactNode, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { clearAccessToken, logout, setAccessToken } from "@aicp/api-client/common";
import { createBrowserSession, type ClientSession } from "@aicp/auth";
import { App as AntApp } from "antd";

import {
  hasRoutePermission,
  paths,
  portal,
  publicLoginPath,
  routeConfig,
  SINGLE_TENANT_SLUG,
  type RouteDefinition,
} from "./routes";
import { AccessDeniedView } from "./shared/shell";
import { LoginView, PasswordChangeView } from "./auth/index";
import { AccountsAndRoles } from "./pages/accounts/index";
import { SentimentMonitorPage } from "./pages/sentiment/index";
import { OpinionArticlesPage } from "./pages/opinion/articles";
import { OpinionPlatformPage } from "./pages/opinion/index";
import { OpinionConfigSectionPage } from "./pages/opinion/config";
import { OpinionTaskDetailPage } from "./pages/opinion/task-detail";
import { OpinionAiModelsPage } from "./pages/opinion/ai-models";
import { OpinionAlertsPage } from "./pages/opinion/alerts";

/** 系统只使用一个固定租户，租户标识不再出现在 URL、登录表单或请求头中。 */
const tenantSlug = SINGLE_TENANT_SLUG;

export function App(): ReactNode {
  return (
    <Routes>
      <Route path={publicLoginPath} element={<PublicLoginRoute />} />
      <Route path="/admin/*" element={<AdminApplication />} />
      <Route path="*" element={<Navigate to={publicLoginPath} replace />} />
    </Routes>
  );
}

function PublicLoginRoute(): ReactNode {
  const navigate = useNavigate();
  const browserSession = useMemo(() => createBrowserSession(portal), []);
  const routePaths = paths(tenantSlug);
  return (
    <LoginView
      tenantSlug={tenantSlug}
      onAuthenticated={(_authenticatedTenantSlug, nextSession) => {
        browserSession.save(tenantSlug, nextSession);
        setAccessToken(nextSession.token);
        void navigate(routePaths.opinion, { replace: true });
      }}
    />
  );
}

function AdminApplication(): ReactNode {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const routePaths = paths(tenantSlug);
  const browserSession = useMemo(() => createBrowserSession(portal), []);
  const [session, setSession] = useState<ClientSession | undefined>(() =>
    browserSession.load(tenantSlug),
  );

  function defaultPath(currentSession: ClientSession | undefined): string {
    if (!currentSession) return routePaths.login;
    return routePaths.opinion;
  }

  function endSession(): void {
    void logout()
      .catch(() => undefined)
      .finally(() => {
        browserSession.clear(tenantSlug);
        clearAccessToken();
        setSession(undefined);
        void navigate(routePaths.login, { replace: true });
      });
  }

  function renderRoute(route: RouteDefinition): ReactNode {
    if (route.access === "public") {
      return session ? (
        <Navigate to={defaultPath(session)} replace />
      ) : (
        <LoginView
          tenantSlug={tenantSlug}
          onAuthenticated={(_authenticatedTenantSlug, nextSession) => {
            browserSession.save(tenantSlug, nextSession);
            setAccessToken(nextSession.token);
            setSession(nextSession);
          }}
        />
      );
    }

    if (!session) return <Navigate to={routePaths.login} replace />;

    if (route.access === "password-change") {
      return (
        <PasswordChangeView
          tenantSlug={tenantSlug}
          onChanged={() => {
            browserSession.clear(tenantSlug);
            clearAccessToken();
            setSession(undefined);
            void navigate(routePaths.login, { replace: true });
          }}
        />
      );
    }

    if (!hasRoutePermission(route, session)) {
      return <AccessDeniedView tenantSlug={tenantSlug} onLogout={endSession} />;
    }

    switch (route.id) {
      case "accounts":
        return (
          <AccountsAndRoles
            session={session}
            tenantSlug={tenantSlug}
            onLogout={endSession}
            onError={(msg) => message.error(msg)}
            onSuccess={(msg) => message.success(msg)}
          />
        );
      case "sentiment":
        return <SentimentMonitorPage session={session} tenantSlug={tenantSlug} onLogout={endSession} />;
      case "opinion":
        return <OpinionPlatformPage session={session} tenantSlug={tenantSlug} onLogout={endSession} />;
      case "opinion-articles":
        return <OpinionArticlesPage session={session} tenantSlug={tenantSlug} onLogout={endSession} />;
      case "opinion-alerts":
        return <OpinionAlertsPage session={session} tenantSlug={tenantSlug} onLogout={endSession} />;
      case "opinion-sources":
        return (
          <OpinionConfigSectionPage
            section="sources"
            session={session}
            tenantSlug={tenantSlug}
            onLogout={endSession}
          />
        );
      case "opinion-tasks":
        return (
          <OpinionConfigSectionPage
            section="tasks"
            session={session}
            tenantSlug={tenantSlug}
            onLogout={endSession}
          />
        );
      case "opinion-ai-models":
        return (
          <OpinionAiModelsPage
            session={session}
            tenantSlug={tenantSlug}
            onLogout={endSession}
          />
        );
      default:
        return <Navigate to={defaultPath(session)} replace />;
    }
  }

  const tasksRoute = routeConfig.find((route) => route.id === "opinion-tasks");

  return (
    <Routes>
      <Route index element={<Navigate to={defaultPath(session)} replace />} />
      <Route
        path="opinion-tasks/:taskId"
        element={
          !session ? (
            <Navigate to={routePaths.login} replace />
          ) : tasksRoute && hasRoutePermission(tasksRoute, session) ? (
            <OpinionTaskDetailPage session={session} tenantSlug={tenantSlug} onLogout={endSession} />
          ) : (
            <AccessDeniedView tenantSlug={tenantSlug} onLogout={endSession} />
          )
        }
      />
      {routeConfig.map((route) => (
        <Route
          key={route.id}
          path={
            route.path
          }
          element={renderRoute(route)}
        />
      ))}
      <Route path="*" element={<Navigate to={defaultPath(session)} replace />} />
    </Routes>
  );
}
