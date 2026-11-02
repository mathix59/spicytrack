import { useQuery, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";

type SessionItem = {
  token: string;
  createdAt: string | Date;
  expiresAt: string | Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

const SESSIONS_QUERY_KEY = ["account", "sessions"] as const;

async function fetchSessions() {
  const [sessionsResult, currentResult] = await Promise.all([
    authClient.listSessions(),
    authClient.getSession(),
  ]);
  if (sessionsResult.error) {
    throw new Error(sessionsResult.error.message ?? "Unable to load sessions");
  }
  const currentToken = currentResult.data?.session.token ?? null;
  const sessions = [...((sessionsResult.data ?? []) as SessionItem[])].sort((left, right) => {
    if (left.token === currentToken) return -1;
    if (right.token === currentToken) return 1;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
  return { sessions, currentToken };
}

function useAccountSessions() {
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery({ queryKey: SESSIONS_QUERY_KEY, queryFn: fetchSessions });
  const refresh = () => queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });

  /** Both actions throw on failure so confirmation dialogs can display the error. */
  const revokeSession = async (session: SessionItem) => {
    const result = await authClient.revokeSession({ token: session.token });
    if (result.error) throw new Error(result.error.message ?? "Unable to revoke the session");
    if (session.token === sessionsQuery.data?.currentToken) {
      window.location.assign("/");
      return;
    }
    await refresh();
  };

  const revokeOtherSessions = async () => {
    const result = await authClient.revokeOtherSessions();
    if (result.error) throw new Error(result.error.message ?? "Unable to revoke other sessions");
    await refresh();
  };

  return {
    sessionsQuery,
    sessions: sessionsQuery.data?.sessions ?? [],
    currentToken: sessionsQuery.data?.currentToken ?? null,
    revokeSession,
    revokeOtherSessions,
  };
}

export { useAccountSessions };
export type { SessionItem };
