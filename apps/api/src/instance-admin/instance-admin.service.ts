import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { asc, count, eq, ilike } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "../common/secrets";
import { DATABASE, type DatabaseClient } from "../database/database.provider";
import { instanceSettings, users } from "../database/schema";

@Injectable()
export class InstanceAdminService {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  async assertSuperAdmin(userId: string) {
    const [user] = await this.db
      .select({ isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user?.isSuperAdmin)
      throw new ForbiddenException("Instance administrator access is required.");
  }

  async get() {
    const [settings] = await this.db
      .select()
      .from(instanceSettings)
      .where(eq(instanceSettings.id, true))
      .limit(1);
    return {
      registrationsEnabled: settings?.registrationsEnabled ?? true,
      smtpHost: settings?.smtpHost ?? null,
      smtpPort: settings?.smtpPort ?? null,
      smtpUser: settings?.smtpUser ?? null,
      smtpFrom: settings?.smtpFrom ?? null,
      smtpPasswordConfigured: Boolean(settings?.smtpPassCiphertext),
    };
  }

  async listUsers(userId: string, search = "", page = 1, pageSize = 20) {
    await this.assertSuperAdmin(userId);
    return this.listUsersUnchecked(search, page, pageSize);
  }

  private async listUsersUnchecked(search = "", page = 1, pageSize = 20) {
    const where = search ? ilike(users.email, `%${search}%`) : undefined;
    const [items, totalRows] = await Promise.all([
      this.db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          createdAt: users.createdAt,
          isSuperAdmin: users.isSuperAdmin,
        })
        .from(users)
        .where(where)
        .orderBy(asc(users.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ total: count() }).from(users).where(where),
    ]);
    return { items, total: totalRows[0]?.total ?? 0, page, pageSize };
  }

  async setSuperAdmin(actorId: string, targetId: string, isSuperAdmin: boolean) {
    await this.db.transaction(async (tx) => {
      const admins = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.isSuperAdmin, true))
        .for("update");
      if (!admins.some((admin) => admin.id === actorId)) {
        throw new ForbiddenException("Instance administrator access is required.");
      }
      const [target] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, targetId))
        .for("update");
      if (!target) throw new NotFoundException("User not found");
      if (!isSuperAdmin && admins.length === 1 && admins[0]?.id === targetId) {
        throw new ForbiddenException("At least one instance administrator is required.");
      }
      await tx
        .update(users)
        .set({ isSuperAdmin, updatedAt: new Date() })
        .where(eq(users.id, targetId));
    });
    return this.listUsersUnchecked();
  }

  async update(
    userId: string,
    input: {
      registrationsEnabled?: boolean;
      smtpHost?: string | null;
      smtpPort?: number | null;
      smtpUser?: string | null;
      smtpPass?: string | null;
      smtpFrom?: string | null;
    },
  ) {
    await this.assertSuperAdmin(userId);
    const values: Record<string, unknown> = { updatedByUserId: userId, updatedAt: new Date() };
    for (const key of [
      "registrationsEnabled",
      "smtpHost",
      "smtpPort",
      "smtpUser",
      "smtpFrom",
    ] as const)
      if (input[key] !== undefined) values[key] = input[key];
    if (input.smtpPass !== undefined)
      values.smtpPassCiphertext = input.smtpPass ? encryptSecret(input.smtpPass) : null;
    await this.db.update(instanceSettings).set(values).where(eq(instanceSettings.id, true));
    return this.get();
  }

  async smtpConfig() {
    const [settings] = await this.db
      .select()
      .from(instanceSettings)
      .where(eq(instanceSettings.id, true))
      .limit(1);
    return settings?.smtpHost
      ? {
          host: settings.smtpHost,
          port: settings.smtpPort ?? 587,
          user: settings.smtpUser ?? undefined,
          pass: settings.smtpPassCiphertext
            ? decryptSecret(settings.smtpPassCiphertext)
            : undefined,
          from: settings.smtpFrom ?? undefined,
        }
      : null;
  }
}
