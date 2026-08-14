import { X } from "lucide-react";

import type { ProjectDto, TeamDto, TeamMemberDto, TeamRoleDto } from "@/generated/api";
import { FormDialogActions } from "@/components/common/form-dialog-actions";
import { cn, renderNullableText } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function TeamCardExpanded({
  team,
  teamMembers,
  teamRoles,
  teamProjects,
  canManage,
  error,
  isRemovingMember,
  onRemoveMember,
}: {
  team: TeamDto;
  teamMembers: TeamMemberDto[];
  teamRoles: TeamRoleDto[];
  teamProjects: ProjectDto[];
  canManage: boolean;
  error: string | null;
  isRemovingMember: boolean;
  onRemoveMember: (userId: string) => Promise<void>;
}) {
  return (
    <div className="grid items-start gap-4 p-4 md:grid-cols-2">
      <section>
        <h4 className="pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Members
        </h4>
        {teamMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            {teamMembers.map((member, index) => (
              <div
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2",
                  index > 0 && "border-t border-border",
                )}
                key={member.userId}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">
                    {renderNullableText(member.name, member.email)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {member.email}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <Badge variant="muted">
                    {teamRoles.find((role) => role.key === member.role)?.name ??
                      renderNullableText(member.role, "member")}
                  </Badge>
                  {canManage ? (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" type="button" variant="ghost">
                          <X className="size-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Remove from team</DialogTitle>
                          <DialogDescription>
                            {member.email} will be removed from {team.name}.
                          </DialogDescription>
                        </DialogHeader>
                        <FormDialogActions
                          buttonType="button"
                          isPending={isRemovingMember}
                          onSubmitClick={() => void onRemoveMember(member.userId)}
                          submitLabel="Confirm"
                          submitVariant="secondary"
                        />
                      </DialogContent>
                    </Dialog>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h4 className="pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Projects
        </h4>
        {teamProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No project scoped to this team.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            {teamProjects.map((project, index) => (
              <div
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2",
                  index > 0 && "border-t border-border",
                )}
                key={project.id}
              >
                <span className="truncate text-sm">{project.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {project.platform} · {project.visibility}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {error ? (
        <Alert className="md:col-span-2" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export { TeamCardExpanded };
