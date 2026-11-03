import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray, or } from "drizzle-orm";
import { DATABASE, type DatabaseClient } from "../database/database.provider";
import * as schema from "../database/schema";

// Explicit cleanup: the schema does not define cascading foreign keys.
const ORGANIZATION_TABLES = [
  schema.organizationAiPricingOverrides,
  schema.aiUsageLedger,
  schema.issueTriageRuns,
  schema.autofixRuns,
  schema.organizationGithubAppSettings,
  schema.projectAutofixConfigs,
  schema.organizationAiSettings,
  schema.organizationSlackSettings,
  schema.organizationGithubAppRepositories,
  schema.repoConnections,
  schema.jobs,
  schema.invitations,
  schema.auditLogs,
  schema.issueActivity,
  schema.issueTickets,
  schema.ticketTrackers,
  schema.issueComments,
  schema.events,
  schema.issues,
  schema.alertDeliveries,
  schema.alertRules,
  schema.releaseCommits,
  schema.releaseArtifacts,
  schema.releases,
  schema.environments,
  schema.projectKeys,
  schema.projectSavedSearches,
  schema.projects,
  schema.teamRoles,
  schema.teamMembers,
  schema.teams,
  schema.mcpCredentials,
  schema.organizationMcpSettings,
  schema.organizationRoles,
  schema.organizationMembers,
];

@Injectable()
export class OrganizationDeletionService {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  async delete(organizationId: string, actorUserId: string) {
    return this.db.transaction(async (tx) => {
      const [organization] = await tx
        .select({ id: schema.organizations.id })
        .from(schema.organizations)
        .where(eq(schema.organizations.id, organizationId))
        .for("update")
        .limit(1);
      if (!organization) throw new NotFoundException("Organization not found");
      const [member] = await tx
        .select({ role: schema.organizationMembers.role })
        .from(schema.organizationMembers)
        .where(
          and(
            eq(schema.organizationMembers.organizationId, organizationId),
            eq(schema.organizationMembers.userId, actorUserId),
          ),
        )
        .for("update")
        .limit(1);
      if (member?.role !== "owner")
        throw new ForbiddenException("Only organization owners can delete an organization");

      await tx
        .delete(schema.mcpCredentialProjects)
        .where(
          inArray(
            schema.mcpCredentialProjects.credentialId,
            tx
              .select({ id: schema.mcpCredentials.id })
              .from(schema.mcpCredentials)
              .where(eq(schema.mcpCredentials.organizationId, organizationId)),
          ),
        );
      await tx
        .delete(schema.alertIssueCooldowns)
        .where(
          inArray(
            schema.alertIssueCooldowns.alertRuleId,
            tx
              .select({ id: schema.alertRules.id })
              .from(schema.alertRules)
              .where(eq(schema.alertRules.organizationId, organizationId)),
          ),
        );
      await tx
        .delete(schema.ingestRateCounters)
        .where(
          or(
            and(
              eq(schema.ingestRateCounters.scope, "organization_hour"),
              eq(schema.ingestRateCounters.scopeId, organizationId),
            ),
            and(
              eq(schema.ingestRateCounters.scope, "project_hour"),
              inArray(
                schema.ingestRateCounters.scopeId,
                tx
                  .select({ id: schema.projects.id })
                  .from(schema.projects)
                  .where(eq(schema.projects.organizationId, organizationId)),
              ),
            ),
            and(
              eq(schema.ingestRateCounters.scope, "project_key_minute"),
              inArray(
                schema.ingestRateCounters.scopeId,
                tx
                  .select({ id: schema.projectKeys.id })
                  .from(schema.projectKeys)
                  .where(eq(schema.projectKeys.organizationId, organizationId)),
              ),
            ),
          ),
        );
      for (const table of ORGANIZATION_TABLES) {
        await tx.delete(table).where(eq(table.organizationId, organizationId));
      }
      await tx.delete(schema.organizations).where(eq(schema.organizations.id, organizationId));
      return { success: true };
    });
  }
}
