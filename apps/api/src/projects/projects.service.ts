import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc as drizzleDesc, eq, inArray, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import {
  organizationMembers,
  organizationRoles,
  projectSavedSearches,
  projects,
  teamMembers,
  teamRoles,
  teams,
} from "../database/schema";
import { ROLE_PERMISSIONS } from "../rbac/permissions.constants";
import { slugify } from "../common/validators";
import { ProjectsCatalogService } from "./projects-catalog.service";
import { ProjectsKeysService } from "./projects-keys.service";

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly auditService: AuditService,
    private readonly projectsCatalogService: ProjectsCatalogService,
    private readonly projectsKeysService: ProjectsKeysService,
  ) {}

  async list(organizationId: string) {
    return this.db.select().from(projects).where(eq(projects.organizationId, organizationId));
  }

  async listAccessible(input: { organizationId: string; userId: string; role: string }) {
    if (await this.hasOrganizationPermission(input.organizationId, input.role, "project.read")) {
      return this.list(input.organizationId);
    }

    const accessibleTeams = this.db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .innerJoin(
        teamRoles,
        and(
          eq(teamRoles.teamId, teamMembers.teamId),
          eq(teamRoles.key, teamMembers.role),
          sql`${teamRoles.permissions} ? 'view_projects'`,
        ),
      )
      .where(
        and(
          eq(teamMembers.organizationId, input.organizationId),
          eq(teamMembers.userId, input.userId),
        ),
      );

    return this.db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.organizationId, input.organizationId),
          sql`${projects.teamId} IS NULL OR ${projects.teamId} IN (${accessibleTeams})`,
        ),
      );
  }

  async create(input: {
    organizationId: string;
    actorUserId: string;
    name: string;
    platform?: string;
    visibility?: string;
    teamId?: string | null;
  }) {
    await this.assertTeamBelongsToOrganization(input.organizationId, input.teamId);
    const slug = await this.generateAvailableSlug(input.organizationId, input.name);

    const [project] = await this.db
      .insert(projects)
      .values({
        organizationId: input.organizationId,
        teamId: input.teamId ?? null,
        name: input.name,
        slug,
        platform: input.platform ?? "javascript",
        visibility: input.visibility ?? "private",
      })
      .returning();

    await this.projectsKeysService.createDefaultKey({
      organizationId: input.organizationId,
      projectId: project.id,
    });

    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: project.id,
      actorUserId: input.actorUserId,
      action: "project.created",
      targetType: "project",
      targetId: project.id,
      payload: { slug: project.slug, teamId: project.teamId },
    });

    return project;
  }

  private async assertOwnershipRuleMembers(
    organizationId: string,
    ownershipRules?: Array<Record<string, unknown>>,
  ) {
    if (!ownershipRules) return;
    const assignedUserIds = [
      ...new Set(
        ownershipRules
          .map((rule) => rule.assignedUserId)
          .filter((userId): userId is string => typeof userId === "string"),
      ),
    ];
    if (assignedUserIds.length === 0) return;
    const members = await this.db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          inArray(organizationMembers.userId, assignedUserIds),
        ),
      );
    if (members.length !== assignedUserIds.length) {
      throw new BadRequestException("Every ownership rule must target an organization member");
    }
  }

  async getBySlug(organizationId: string, projectSlug: string) {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.organizationId, organizationId), eq(projects.slug, projectSlug)))
      .limit(1);

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    return project;
  }

  async getAccessibleBySlug(input: { organizationId: string; projectSlug: string }) {
    return this.getBySlug(input.organizationId, input.projectSlug);
  }

  private async hasOrganizationPermission(
    organizationId: string,
    roleKey: string,
    permission: string,
  ) {
    const systemPermissions = ROLE_PERMISSIONS[roleKey as keyof typeof ROLE_PERMISSIONS];
    if (systemPermissions) return systemPermissions.includes(permission as never);

    const [role] = await this.db
      .select({ permissions: organizationRoles.permissions })
      .from(organizationRoles)
      .where(
        and(
          eq(organizationRoles.organizationId, organizationId),
          eq(organizationRoles.key, roleKey),
        ),
      )
      .limit(1);
    const permissions = (role?.permissions as string[] | undefined) ?? [];
    return permissions.includes(permission);
  }

  async updateProject(input: {
    organizationId: string;
    projectId: string;
    actorUserId: string;
    name?: string;
    platform?: string;
    status?: string;
    visibility?: string;
    teamId?: string | null;
    retentionDays?: number;
    inboundRules?: Array<Record<string, unknown>>;
    ownershipRules?: Array<Record<string, unknown>>;
    piiScrubFields?: string[];
  }) {
    await this.assertOwnershipRuleMembers(input.organizationId, input.ownershipRules);
    await this.assertTeamBelongsToOrganization(input.organizationId, input.teamId);

    const slug = input.name
      ? await this.generateAvailableSlug(input.organizationId, input.name, input.projectId)
      : undefined;

    const [project] = await this.db
      .update(projects)
      .set({
        name: input.name,
        slug,
        platform: input.platform,
        status: input.status,
        visibility: input.visibility,
        teamId: input.teamId,
        retentionDays: input.retentionDays,
        inboundRules: input.inboundRules,
        ownershipRules: input.ownershipRules,
        piiScrubFields: input.piiScrubFields,
        updatedAt: new Date(),
      })
      .where(
        and(eq(projects.organizationId, input.organizationId), eq(projects.id, input.projectId)),
      )
      .returning();

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: "project.update",
      targetType: "project",
      targetId: input.projectId,
      payload: {
        name: input.name,
        slug,
        platform: input.platform,
        status: input.status,
        visibility: input.visibility,
        teamId: input.teamId,
        retentionDays: input.retentionDays,
        inboundRules: input.inboundRules,
        ownershipRules: input.ownershipRules,
        piiScrubFields: input.piiScrubFields,
      },
    });

    return project;
  }

  private async assertTeamBelongsToOrganization(organizationId: string, teamId?: string | null) {
    if (!teamId) return;
    const [team] = await this.db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.organizationId, organizationId)))
      .limit(1);
    if (!team) {
      throw new BadRequestException("Team must belong to the project organization");
    }
  }

  private async generateAvailableSlug(
    organizationId: string,
    name: string,
    excludedProjectId?: string,
  ) {
    const baseSlug = slugify(name);

    if (!baseSlug) {
      throw new BadRequestException("Project name cannot generate a valid slug");
    }

    const existing = await this.db
      .select({ id: projects.id, slug: projects.slug })
      .from(projects)
      .where(eq(projects.organizationId, organizationId));
    const usedSlugs = new Set(
      existing.filter((project) => project.id !== excludedProjectId).map((project) => project.slug),
    );

    if (!usedSlugs.has(baseSlug)) {
      return baseSlug;
    }

    let suffix = 2;
    while (usedSlugs.has(`${baseSlug}-${suffix}`)) {
      suffix += 1;
    }

    return `${baseSlug}-${suffix}`;
  }

  async listKeys(input: { projectId: string; projectPublicId: number; publicBaseUrl?: string }) {
    return this.projectsKeysService.listKeys(input);
  }

  async listSavedSearches(input: { projectId: string; userId: string }) {
    return this.db
      .select()
      .from(projectSavedSearches)
      .where(
        and(
          eq(projectSavedSearches.projectId, input.projectId),
          eq(projectSavedSearches.userId, input.userId),
        ),
      )
      .orderBy(drizzleDesc(projectSavedSearches.createdAt));
  }

  async createSavedSearch(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    name: string;
    filters: Record<string, unknown>;
  }) {
    const [savedSearch] = await this.db
      .insert(projectSavedSearches)
      .values({
        organizationId: input.organizationId,
        projectId: input.projectId,
        userId: input.userId,
        name: input.name,
        filters: input.filters,
      })
      .returning();

    return savedSearch;
  }

  async deleteSavedSearch(input: { projectId: string; userId: string; savedSearchId: string }) {
    const [savedSearch] = await this.db
      .delete(projectSavedSearches)
      .where(
        and(
          eq(projectSavedSearches.id, input.savedSearchId),
          eq(projectSavedSearches.projectId, input.projectId),
          eq(projectSavedSearches.userId, input.userId),
        ),
      )
      .returning({ id: projectSavedSearches.id });

    if (!savedSearch) {
      throw new NotFoundException("Saved search not found");
    }

    return { success: true };
  }

  async listEnvironments(projectId: string) {
    return this.projectsCatalogService.listEnvironments(projectId);
  }

  async listReleases(projectId: string) {
    return this.projectsCatalogService.listReleases(projectId);
  }

  async getReleaseDetail(input: { projectId: string; releaseVersion: string }) {
    return this.projectsCatalogService.getReleaseDetail(input);
  }

  async listAudit(projectId: string) {
    return this.auditService.listProjectAudit(projectId);
  }

  async updateKey(input: {
    organizationId: string;
    projectId: string;
    actorUserId: string;
    keyId: string;
    name?: string;
    isActive?: boolean;
    rateLimitPerMinute?: number | null;
    publicBaseUrl?: string;
    projectPublicId: number;
  }) {
    return this.projectsKeysService.updateKey(input);
  }

  async rotateKey(input: {
    organizationId: string;
    projectId: string;
    actorUserId: string;
    keyId: string;
    publicBaseUrl?: string;
    projectPublicId: number;
  }) {
    return this.projectsKeysService.rotateKey(input);
  }

  async createKey(input: {
    organizationId: string;
    projectId: string;
    actorUserId: string;
    projectSlug: string;
    projectPublicId: number;
    name: string;
    rateLimitPerMinute?: number;
    publicBaseUrl?: string;
  }) {
    return this.projectsKeysService.createKey(input);
  }
}
