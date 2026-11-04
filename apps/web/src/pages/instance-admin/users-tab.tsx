import { Search, Users } from "lucide-react";

import { useGetMe } from "@/generated/api";

import { QueryError } from "@/components/common/query-error";
import { OrganizationSectionHeader } from "@/components/organizations/organization-section-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SkeletonRows } from "@/components/ui/skeleton";

import { InstanceUserRow } from "./instance-user-row";
import { useInstanceUsers } from "./use-instance-users";

export function UsersTab() {
  const state = useInstanceUsers();
  const currentUserId = useGetMe().data?.data.user.id;
  const { usersQuery, users, total, superAdminCount, page, pageSize, search } = state;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card className="overflow-hidden">
      <OrganizationSectionHeader
        count={usersQuery.data ? total : undefined}
        description="Everyone with an account on this instance."
        title="Users"
      />
      <CardContent className="grid gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search users"
            className="pl-9"
            onChange={(e) => state.setSearch(e.target.value)}
            placeholder="Search by email…"
            type="search"
            value={search}
          />
        </div>

        {usersQuery.isPending ? (
          <SkeletonRows rows={4} />
        ) : usersQuery.isError && !usersQuery.data ? (
          <QueryError
            error={usersQuery.error}
            onRetry={() => void usersQuery.refetch()}
            title="Could not load users"
          />
        ) : users.length === 0 ? (
          <EmptyState
            description={
              search.trim()
                ? "No account matches this search. Try another email address."
                : "Nobody has created an account yet."
            }
            icon={Users}
            title="No users found"
          />
        ) : (
          <ul aria-busy={usersQuery.isFetching} className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {users.map((user) => (
              <InstanceUserRow
                isCurrentUser={user.id === currentUserId}
                isLastSuperAdmin={
                  user.isSuperAdmin && superAdminCount !== undefined && superAdminCount <= 1
                }
                key={user.id}
                onChangeRole={state.changeRole}
                onDelete={state.deleteUser}
                user={user}
              />
            ))}
          </ul>
        )}

        {total > pageSize ? (
          <div className="flex items-center justify-between gap-3 pt-2 text-sm text-muted-foreground">
            <span>
              Page {page} of {pageCount} · {total} users
            </span>
            <div className="flex gap-2">
              <Button
                disabled={page === 1}
                onClick={() => state.setPage(page - 1)}
                size="sm"
                variant="outline"
              >
                Previous
              </Button>
              <Button
                disabled={page >= pageCount}
                onClick={() => state.setPage(page + 1)}
                size="sm"
                variant="outline"
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
