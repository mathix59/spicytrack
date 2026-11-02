import { Laptop, LogOut, RefreshCw, Smartphone } from "lucide-react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { formatLocalDateTime } from "@/lib/utils";

import { AccountSection } from "./account-section";
import { describeUserAgent } from "./describe-user-agent";
import { type SessionItem, useAccountSessions } from "./use-account-sessions";

function SessionRow({
  session,
  isCurrent,
  onRevoke,
}: {
  session: SessionItem;
  isCurrent: boolean;
  onRevoke: (session: SessionItem) => Promise<void>;
}) {
  const device = describeUserAgent(session.userAgent);
  const Icon = device.mobile ? Smartphone : Laptop;
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium" title={session.userAgent ?? undefined}>
              {device.label}
            </span>
            {isCurrent ? <Badge variant="accent">This device</Badge> : null}
          </div>
          <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {session.ipAddress || "Unknown IP address"}
          </p>
          <p className="text-xs text-muted-foreground">
            Signed in {formatLocalDateTime(String(session.createdAt))} · expires{" "}
            {formatLocalDateTime(String(session.expiresAt))}
          </p>
        </div>
      </div>
      <ConfirmDialog
        confirmLabel={isCurrent ? "Sign out" : "Revoke session"}
        description={
          isCurrent
            ? "This is the session you're using right now. You'll be signed out immediately."
            : `${device.label} will be signed out and need to sign in again.`
        }
        onConfirm={() => onRevoke(session)}
        successMessage={isCurrent ? undefined : "Session revoked"}
        title={isCurrent ? "Sign out of this device?" : "Revoke this session?"}
        trigger={
          <Button className="self-start sm:self-auto" size="sm" type="button" variant="ghost">
            {isCurrent ? "Sign out" : "Revoke"}
          </Button>
        }
      />
    </li>
  );
}

function AccountSessionsCard() {
  const { sessionsQuery, sessions, currentToken, revokeSession, revokeOtherSessions } =
    useAccountSessions();
  const otherCount = sessions.filter((session) => session.token !== currentToken).length;

  return (
    <AccountSection
      action={
        <>
          <Button
            aria-label="Refresh sessions"
            disabled={sessionsQuery.isFetching}
            onClick={() => void sessionsQuery.refetch()}
            size="icon-sm"
            title="Refresh sessions"
            type="button"
            variant="ghost"
          >
            <RefreshCw className={sessionsQuery.isFetching ? "animate-spin" : undefined} />
          </Button>
          {otherCount > 0 ? (
            <ConfirmDialog
              confirmLabel="Sign out others"
              description={`${otherCount} other ${otherCount === 1 ? "session" : "sessions"} will be signed out. This device stays signed in.`}
              onConfirm={revokeOtherSessions}
              successMessage="Other sessions signed out"
              title="Sign out all other sessions?"
              trigger={
                <Button size="sm" type="button" variant="secondary">
                  <LogOut />
                  Sign out others
                </Button>
              }
            />
          ) : null}
        </>
      }
      description="Devices and browsers currently signed in to your account."
      icon={Laptop}
      title="Active sessions"
    >
      {sessionsQuery.isPending ? (
        <SkeletonRows rows={2} />
      ) : sessionsQuery.isError ? (
        <QueryError
          error={sessionsQuery.error}
          onRetry={() => void sessionsQuery.refetch()}
          title="Could not load your sessions"
        />
      ) : sessions.length === 0 ? (
        <EmptyState
          description="Sessions appear here once you sign in from a browser."
          icon={Laptop}
          title="No active sessions"
        />
      ) : (
        <ul className="grid gap-2">
          {sessions.map((session) => (
            <SessionRow
              isCurrent={session.token === currentToken}
              key={session.token}
              onRevoke={revokeSession}
              session={session}
            />
          ))}
        </ul>
      )}
    </AccountSection>
  );
}

export { AccountSessionsCard };
