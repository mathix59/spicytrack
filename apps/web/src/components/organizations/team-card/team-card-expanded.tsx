import { X } from "lucide-react";

import type { ProjectDto, TeamDto, TeamMemberDto, TeamRoleDto } from "@/generated/api";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { cn, renderNullableText } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function TeamCardExpanded({
  team,
  teamMembers,
  teamRoles,
  teamProjects,
  canManage,
  isRemovingMember,
  onRemoveMember,
}: {
  team: TeamDto;
  teamMembers: TeamMemberDto[];
  teamRoles: TeamRoleDto[];
  teamProjects: ProjectDto[];
  canManage: boolean;
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
                    <ConfirmDialog
                      confirmLabel="Remove from team"
                      description={`${member.email} will be removed from ${team.name}.`}
                      onConfirm={() => onRemoveMember(member.userId)}
                      successMessage="Member removed from team"
                      title="Remove from team"
                      trigger={
                        <Button
                          aria-label={`Remove ${member.email} from ${team.name}`}
                          disabled={isRemovingMember}
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <X className="size-3.5" />
                        </Button>
                      }
                    />
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
    </div>
  );
}

export { TeamCardExpanded };
