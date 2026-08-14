import { useCallback, useEffect, useState } from "react";
import { Laptop, RefreshCw } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { formatLocalDateTime } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SessionItem = {
  token: string;
  createdAt: string | Date;
  expiresAt: string | Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function AccountSessionsCard() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const load = useCallback(async () => {
    const [sessionsResult, currentResult] = await Promise.all([
      authClient.listSessions(),
      authClient.getSession(),
    ]);
    if (sessionsResult.error) {
      throw new Error(sessionsResult.error.message ?? "Unable to load sessions");
    }
    setSessions((sessionsResult.data ?? []) as SessionItem[]);
    setCurrentToken(currentResult.data?.session.token ?? null);
  }, []);

  useEffect(() => {
    void load().catch((caughtError: unknown) =>
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load sessions"),
    );
  }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    setIsPending(true);
    try {
      await action();
      await load();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update sessions");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Laptop className="size-4 text-muted-foreground" />
          <CardTitle>Active sessions</CardTitle>
        </div>
        <Button
          disabled={isPending || sessions.length <= 1}
          onClick={() => void run(() => authClient.revokeOtherSessions())}
          size="sm"
          variant="secondary"
        >
          Revoke others
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {sessions.map((session) => {
          const isCurrent = session.token === currentToken;
          return (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              key={session.token}
            >
              <div className="min-w-0 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{session.ipAddress ?? "Unknown IP"}</span>
                  {isCurrent ? <Badge variant="accent">current</Badge> : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {session.userAgent ?? "Unknown device"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Created {formatLocalDateTime(String(session.createdAt))} · expires{" "}
                  {formatLocalDateTime(String(session.expiresAt))}
                </p>
              </div>
              <Button
                disabled={isPending}
                onClick={() =>
                  void run(async () => {
                    const result = await authClient.revokeSession({ token: session.token });
                    if (result.error) throw new Error(result.error.message);
                    if (isCurrent) window.location.assign("/");
                  })
                }
                size="sm"
                variant="ghost"
              >
                Revoke
              </Button>
            </div>
          );
        })}
        <Button
          disabled={isPending}
          onClick={() => void run(async () => undefined)}
          variant="ghost"
        >
          <RefreshCw className="size-4" />
          Refresh sessions
        </Button>
      </CardContent>
    </Card>
  );
}

export { AccountSessionsCard };
