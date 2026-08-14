import { useState } from "react";
import { Shield, UserRound } from "lucide-react";
import { OrganizationSectionHeader } from "@/components/organizations/organization-section-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { InstanceUser } from "../instance-admin-page";
export function UsersTab({
  users,
  total,
  page,
  pageSize,
  onSearch,
  onChangeRole,
}: {
  users: InstanceUser[];
  total: number;
  page: number;
  pageSize: number;
  onSearch: (s: string, p?: number) => Promise<void>;
  onChangeRole: (id: string, v: boolean) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  return (
    <Card className="overflow-hidden">
      <OrganizationSectionHeader count={total} title="Users" />
      <CardContent className="grid gap-2">
        <Input
          placeholder="Search by email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            void onSearch(e.target.value, 1);
          }}
        />
        {users.map((user) => (
          <div className="flex items-center justify-between rounded-lg border p-3" key={user.id}>
            <div className="flex items-center gap-3">
              <UserRound className="size-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{user.name || user.email}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Shield className="size-4 text-primary" />
              Super-admin
              <Switch
                aria-label={`Super-admin access for ${user.email}`}
                checked={user.isSuperAdmin}
                onCheckedChange={(v) => void onChangeRole(user.id, v)}
              />
            </label>
          </div>
        ))}
        <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
          <span>{total} users</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => void onSearch(search, page - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page * pageSize >= total}
              onClick={() => void onSearch(search, page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
