import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { LoadingScreen } from "@/components/common/loading-screen";
import { AppShell } from "@/components/layout/app-shell";
import { getGetMeQueryKey, useGetMe } from "@/generated/api";

const LAST_ORG_KEY = "spicytrack.lastOrg";
const AUTH_RETURN_TO_KEY = "spicytrack.authReturnTo";

function safeReturnTo(value: string | null | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null;
}

const AuthPage = lazy(() =>
  import("@/pages/auth-page").then((module) => ({ default: module.AuthPage })),
);
const ResetPasswordPage = lazy(() =>
  import("@/pages/reset-password-page").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const VerifyEmailPage = lazy(() =>
  import("@/pages/verify-email-page").then((module) => ({
    default: module.VerifyEmailPage,
  })),
);
const InvitationAcceptPage = lazy(() =>
  import("@/pages/invitation-accept-page").then((module) => ({
    default: module.InvitationAcceptPage,
  })),
);
const TwoFactorPage = lazy(() =>
  import("@/pages/two-factor-page").then((module) => ({
    default: module.TwoFactorPage,
  })),
);
const DashboardPage = lazy(() =>
  import("@/pages/dashboard-page").then((module) => ({
    default: module.DashboardPage,
  })),
);
const OrganizationPage = lazy(() =>
  import("@/pages/organization-page").then((module) => ({
    default: module.OrganizationPage,
  })),
);
const ProjectPage = lazy(() =>
  import("@/pages/project-page").then((module) => ({
    default: module.ProjectPage,
  })),
);
const IssueDetailPage = lazy(() =>
  import("@/pages/issue-detail-page").then((module) => ({
    default: module.IssueDetailPage,
  })),
);
const AccountPage = lazy(() =>
  import("@/pages/account-page").then((module) => ({
    default: module.AccountPage,
  })),
);
const GithubAppSetupPage = lazy(() =>
  import("@/pages/github-app-setup-page").then((module) => ({
    default: module.GithubAppSetupPage,
  })),
);
const InstanceAdminPage = lazy(() =>
  import("@/pages/instance-admin-page").then((module) => ({ default: module.InstanceAdminPage })),
);

const retryUnlessUnauthorized = (failureCount: number, error: unknown) =>
  (error as { status?: number } | null)?.status !== 401 && failureCount < 3;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthGate />} />
      <Route
        path="/reset-password"
        element={
          <RouteSuspense label="Loading reset flow…">
            <ResetPasswordPage />
          </RouteSuspense>
        }
      />
      <Route
        path="/verify-email"
        element={
          <RouteSuspense label="Loading verification…">
            <VerifyEmailPage />
          </RouteSuspense>
        }
      />
      <Route
        path="/invitations/accept"
        element={
          <RouteSuspense label="Loading invitation…">
            <InvitationAcceptPage />
          </RouteSuspense>
        }
      />
      <Route
        path="/two-factor"
        element={
          <RouteSuspense label="Loading two-factor verification…">
            <TwoFactorPage />
          </RouteSuspense>
        }
      />
      <Route path="/app" element={<ProtectedArea />} />
      <Route path="/account" element={<ProtectedArea view="account" />} />
      <Route path="/github-app/setup" element={<ProtectedArea view="github-app-setup" />} />
      <Route path="/admin" element={<ProtectedArea view="instance-admin" />} />
      <Route path="/orgs/:orgSlug" element={<ProtectedArea />} />
      <Route path="/orgs/:orgSlug/projects/:projectSlug" element={<ProtectedArea />} />
      <Route
        path="/orgs/:orgSlug/projects/:projectSlug/issues/:issueId"
        element={<ProtectedArea />}
      />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

function AuthGate() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const stateReturnTo = safeReturnTo((location.state as { returnTo?: string } | null)?.returnTo);
  const returnTo = stateReturnTo ?? safeReturnTo(sessionStorage.getItem(AUTH_RETURN_TO_KEY));
  const meQuery = useGetMe({
    query: { retry: retryUnlessUnauthorized },
  });

  useEffect(() => {
    if (stateReturnTo) sessionStorage.setItem(AUTH_RETURN_TO_KEY, stateReturnTo);
  }, [stateReturnTo]);

  if (meQuery.isLoading) {
    return <LoadingScreen label="Loading your session..." />;
  }

  if (meQuery.data?.data) {
    return <AuthenticatedRedirect returnTo={returnTo} />;
  }

  return (
    <RouteSuspense label="Loading authentication…">
      <AuthPage
        onAuthenticated={async () => {
          await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
          navigate(returnTo ?? "/app", { replace: true });
        }}
      />
    </RouteSuspense>
  );
}

function AuthenticatedRedirect({ returnTo }: { returnTo: string | null }) {
  useEffect(() => sessionStorage.removeItem(AUTH_RETURN_TO_KEY), []);
  return <Navigate to={returnTo ?? "/app"} replace />;
}

function ProtectedArea({ view }: { view?: "account" | "github-app-setup" | "instance-admin" }) {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meQuery = useGetMe({
    query: { retry: retryUnlessUnauthorized },
  });

  useEffect(() => {
    if (params.orgSlug) {
      localStorage.setItem(LAST_ORG_KEY, params.orgSlug);
    }
  }, [params.orgSlug]);

  const errorStatus = (meQuery.error as { status?: number } | null)?.status;
  if (errorStatus === 401) {
    return <Navigate to="/" replace />;
  }

  if (meQuery.isLoading) {
    return <LoadingScreen label="Loading your session..." />;
  }

  const profile = meQuery.data?.data;
  if (!profile) {
    return <LoadingScreen label="Loading your profile..." />;
  }

  const storedOrgSlug = localStorage.getItem(LAST_ORG_KEY);
  const fallbackOrgSlug =
    profile.memberships.find((membership) => membership.slug === storedOrgSlug)?.slug ??
    profile.memberships[0]?.slug;
  const currentOrgSlug = params.orgSlug ?? fallbackOrgSlug;

  const handleLogout = () => {
    localStorage.removeItem(LAST_ORG_KEY);
    queryClient.clear();
    navigate("/");
  };

  return (
    <AppShell currentOrgSlug={currentOrgSlug} me={profile} onLogout={handleLogout}>
      <RouteSuspense label="Loading workspace…">
        {view === "account" ? (
          <AccountPage />
        ) : view === "github-app-setup" ? (
          <GithubAppSetupPage />
        ) : view === "instance-admin" ? (
          <InstanceAdminPage />
        ) : params.orgSlug && params.projectSlug && params.issueId ? (
          <IssueDetailPage key={params.issueId} />
        ) : params.orgSlug && params.projectSlug ? (
          <ProjectPage key={`${params.orgSlug}/${params.projectSlug}`} />
        ) : params.orgSlug ? (
          <OrganizationPage key={params.orgSlug} />
        ) : (
          <DashboardPage />
        )}
      </RouteSuspense>
    </AppShell>
  );
}

function RouteSuspense({ children, label }: { children: React.ReactNode; label: string }) {
  return <Suspense fallback={<LoadingScreen compact label={label} />}>{children}</Suspense>;
}
