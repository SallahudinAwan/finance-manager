import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ApiError, api } from "./api/client";
import { AppShell } from "./components/AppShell";
import { Skeleton } from "./components/ui";
import { I18nProvider } from "./i18n";
import type { Session } from "./types";

const AccountPage = lazy(() =>
  import("./pages/AccountPage").then((module) => ({ default: module.AccountPage })),
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })),
);
const InvitePage = lazy(() =>
  import("./pages/InvitePage").then((module) => ({ default: module.InvitePage })),
);
const LandingPage = lazy(() =>
  import("./pages/LandingPage").then((module) => ({ default: module.LandingPage })),
);
const LegalPage = lazy(() =>
  import("./pages/LegalPage").then((module) => ({ default: module.LegalPage })),
);
const LanguageSetupPage = lazy(() =>
  import("./pages/LanguageSetupPage").then((module) => ({
    default: module.LanguageSetupPage,
  })),
);
const MonthPage = lazy(() =>
  import("./pages/MonthPage").then((module) => ({ default: module.MonthPage })),
);
const NotificationsPage = lazy(() =>
  import("./pages/NotificationsPage").then((module) => ({
    default: module.NotificationsPage,
  })),
);
const OnboardingPage = lazy(() =>
  import("./pages/OnboardingPage").then((module) => ({ default: module.OnboardingPage })),
);
const ReportsPage = lazy(() =>
  import("./pages/ReportsPage").then((module) => ({ default: module.ReportsPage })),
);
const SavingsPage = lazy(() =>
  import("./pages/SavingsPage").then((module) => ({ default: module.SavingsPage })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })),
);

function PageFallback() {
  return (
    <div className="boot-screen">
      <div className="boot-brand">FM</div>
      <Skeleton height={10} />
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<Session>("/session/"),
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  });

  if (session.isLoading) {
    return <PageFallback />;
  }
  if (session.isError || !session.data) {
    let publicPage = <LandingPage />;
    if (location.pathname === "/privacy") publicPage = <LegalPage kind="privacy" />;
    if (location.pathname === "/terms") publicPage = <LegalPage kind="terms" />;
    if (location.pathname === "/data-deletion") {
      publicPage = <LegalPage kind="data-deletion" />;
    }
    return <Suspense fallback={<PageFallback />}>{publicPage}</Suspense>;
  }
  if (session.data.needs_language_selection || !session.data.user.preferred_language) {
    return (
      <Suspense fallback={<PageFallback />}>
        <LanguageSetupPage session={session.data} />
      </Suspense>
    );
  }
  if (location.pathname.startsWith("/invite/")) {
    return (
      <I18nProvider language={session.data.user.preferred_language}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/invite/:token" element={<InvitePage />} />
          </Routes>
        </Suspense>
      </I18nProvider>
    );
  }
  if (session.data.needs_onboarding) {
    return (
      <I18nProvider language={session.data.user.preferred_language}>
        <Suspense fallback={<PageFallback />}>
          <OnboardingPage session={session.data} />
        </Suspense>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider language={session.data.user.preferred_language}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/app" element={<AppShell session={session.data} />}>
            <Route index element={<DashboardPage />} />
            <Route path="month" element={<MonthPage />} />
            <Route path="month/:label" element={<MonthPage />} />
            <Route path="savings" element={<SavingsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="account" element={<AccountPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </Suspense>
    </I18nProvider>
  );
}
