import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { ForbiddenException } from "@nestjs/common";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../src/database/schema";
import { OrganizationDeletionService } from "../src/organizations/organization-deletion.service";

// A private schema keeps this regression isolated from development data.
describe("organization deletion persistence", () => {
  const schemaName = `deletion_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: process.env.DATABASE_URL });
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schemaName}`,
  });
  const db = drizzle(pool, { schema });
  const ownerId = randomUUID();
  const memberId = randomUUID();
  const orgId = randomUUID();
  const otherOrgId = randomUUID();
  const projectId = randomUUID();
  const credentialId = randomUUID();
  const keyId = randomUUID();

  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA "${schemaName}"`);
    await migrate(db, {
      migrationsFolder: resolve(__dirname, "../drizzle"),
      migrationsSchema: schemaName,
    });
    await db.insert(schema.organizations).values([
      { id: orgId, name: "Delete", slug: "delete", ownerUserId: ownerId },
      { id: otherOrgId, name: "Keep", slug: "keep", ownerUserId: ownerId },
    ]);
    await db.insert(schema.organizationMembers).values([
      { organizationId: orgId, userId: ownerId, role: "owner" },
      { organizationId: orgId, userId: memberId, role: "admin" },
      { organizationId: otherOrgId, userId: ownerId, role: "owner" },
    ]);
    await db
      .insert(schema.projects)
      .values({ id: projectId, organizationId: orgId, name: "Project", slug: "project" });
    await db
      .insert(schema.projectKeys)
      .values({ id: keyId, organizationId: orgId, projectId, name: "key", publicKey: "test-key" });
    await db.insert(schema.ticketTrackers).values({
      organizationId: orgId,
      projectId,
      provider: "linear",
      name: "Linear",
      config: { provider: "linear", teamId: "t", teamKey: "ENG", teamName: "Eng" },
      tokenCiphertext: "ciphertext",
    });
    await db.insert(schema.organizationSlackSettings).values({
      organizationId: orgId,
      teamId: "T1",
      signingSecretCiphertext: "ciphertext",
      botTokenCiphertext: "ciphertext",
    });
    const [release] = await db
      .insert(schema.releases)
      .values({ organizationId: orgId, projectId, version: "1.0.0" })
      .returning({ id: schema.releases.id });
    const [bucket] = await db
      .insert(schema.releaseHealthBuckets)
      .values({
        organizationId: orgId,
        projectId,
        releaseId: release.id,
        bucketStart: new Date(),
        sessions: 1,
      })
      .returning({ id: schema.releaseHealthBuckets.id });
    await db
      .insert(schema.releaseHealthSessions)
      .values({ projectId, sessionId: "s1", bucketId: bucket.id });
    await db.insert(schema.releaseHealthUsers).values({
      projectId,
      releaseId: release.id,
      day: "2026-01-01",
      userHash: "hash",
    });
    await db.insert(schema.mcpCredentials).values({
      id: credentialId,
      organizationId: orgId,
      createdByUserId: ownerId,
      name: "MCP",
      tokenHash: "hash",
      tokenPreview: "preview",
    });
    await db.insert(schema.mcpCredentialProjects).values({ credentialId, projectId });
    await db.insert(schema.ingestRateCounters).values([
      { scope: "project_key_minute", scopeId: keyId, windowStartedAt: new Date(), count: 1 },
      { scope: "project_hour", scopeId: projectId, windowStartedAt: new Date(), count: 1 },
      { scope: "project_sessions_hour", scopeId: projectId, windowStartedAt: new Date(), count: 1 },
      { scope: "organization_hour", scopeId: orgId, windowStartedAt: new Date(), count: 1 },
      { scope: "organization_hour", scopeId: otherOrgId, windowStartedAt: new Date(), count: 1 },
    ]);
  });
  afterAll(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await admin.end();
  });
  it("rejects admins without deleting data, then removes only the owner's target organization", async () => {
    const service = new OrganizationDeletionService(db);
    await expect(service.delete(orgId, memberId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(await db.select().from(schema.projects)).toHaveLength(1);
    await expect(service.delete(orgId, ownerId)).resolves.toEqual({ success: true });
    expect(await db.select().from(schema.organizations)).toMatchObject([{ id: otherOrgId }]);
    expect(
      await db
        .select()
        .from(schema.organizationMembers)
        .where(eq(schema.organizationMembers.organizationId, orgId)),
    ).toHaveLength(0);
    expect(await db.select().from(schema.projects)).toHaveLength(0);
    expect(await db.select().from(schema.projectKeys)).toHaveLength(0);
    expect(await db.select().from(schema.mcpCredentials)).toHaveLength(0);
    expect(await db.select().from(schema.ticketTrackers)).toHaveLength(0);
    expect(await db.select().from(schema.organizationSlackSettings)).toHaveLength(0);
    expect(await db.select().from(schema.mcpCredentialProjects)).toHaveLength(0);
    expect(await db.select().from(schema.releaseHealthBuckets)).toHaveLength(0);
    expect(await db.select().from(schema.releaseHealthSessions)).toHaveLength(0);
    expect(await db.select().from(schema.releaseHealthUsers)).toHaveLength(0);
    expect(await db.select().from(schema.ingestRateCounters)).toMatchObject([
      { scopeId: otherOrgId },
    ]);
  });
});
