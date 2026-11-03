import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createTransport } from "nodemailer";
import { smtpTransportOptions } from "../email/smtp-options";
import { asc, count, eq, ilike } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "../common/secrets";
import { DATABASE, primaryDatabase, type DatabaseClient } from "../database/database.provider";
import { instanceSettings, users } from "../database/schema";

/**
 * The stored password is only reused against the stored server, so a test cannot send it to an
 * arbitrary host.
 */
export function storedPasswordFor(
  stored: { host: string; port: number; pass?: string } | null,
  host: string,
  port: number,
) {
  if (!stored?.pass) return undefined;
  if (stored.host.toLowerCase() !== host.toLowerCase() || stored.port !== port) {
    throw new BadRequestException(
      "Enter the SMTP password to test a different host or port than the saved one.",
    );
  }
  return stored.pass;
}

@Injectable()
export class InstanceAdminService {
  private readonly db: DatabaseClient;

  constructor(@Inject(DATABASE) database: DatabaseClient) {
    this.db = primaryDatabase(database);
  }

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
      smtpSecure: settings?.smtpSecure ?? null,
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
      smtpSecure?: boolean | null;
      smtpUser?: string | null;
      smtpPass?: string | null;
      smtpFrom?: string | null;
    },
  ) {
    await this.assertSuperAdmin(userId);
    this.validateSettings(input);
    const values: Partial<typeof instanceSettings.$inferInsert> = {
      updatedByUserId: userId,
      updatedAt: new Date(),
    };
    for (const key of [
      "registrationsEnabled",
      "smtpHost",
      "smtpPort",
      "smtpSecure",
      "smtpUser",
      "smtpFrom",
    ] as const)
      if (input[key] !== undefined) Object.assign(values, { [key]: input[key] });
    if (input.smtpPass !== undefined)
      values.smtpPassCiphertext = input.smtpPass ? encryptSecret(input.smtpPass) : null;
    await this.db
      .insert(instanceSettings)
      .values({ id: true, ...values })
      .onConflictDoUpdate({ target: instanceSettings.id, set: values });
    return this.get();
  }

  private validateSettings(input: Parameters<InstanceAdminService["update"]>[1]) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new BadRequestException("Settings must be a JSON object.");
    }
    if (
      input.registrationsEnabled !== undefined &&
      typeof input.registrationsEnabled !== "boolean"
    ) {
      throw new BadRequestException("Registrations enabled must be a boolean.");
    }
    for (const key of ["smtpHost", "smtpUser", "smtpPass", "smtpFrom"] as const) {
      if (input[key] != null && typeof input[key] !== "string")
        throw new BadRequestException(`${key} must be a string.`);
    }
    if (
      input.smtpPort != null &&
      (!Number.isInteger(input.smtpPort) || input.smtpPort < 1 || input.smtpPort > 65535)
    ) {
      throw new BadRequestException("SMTP port must be between 1 and 65535.");
    }
    if (input.smtpSecure != null && typeof input.smtpSecure !== "boolean") {
      throw new BadRequestException("SMTP secure must be a boolean.");
    }
  }

  async testSmtp(userId: string, input: Parameters<InstanceAdminService["update"]>[1]) {
    await this.assertSuperAdmin(userId);
    this.validateSettings(input);
    if (!input.smtpHost?.trim()) throw new BadRequestException("SMTP host is required.");
    const host = input.smtpHost.trim();
    const port = input.smtpPort ?? 587;
    const stored = input.smtpPass == null ? await this.smtpConfig() : null;
    const transporter = createTransport({
      ...smtpTransportOptions({
        host,
        port,
        secure: input.smtpSecure,
        user: input.smtpUser ?? undefined,
        pass: input.smtpPass ?? storedPasswordFor(stored, host, port),
      }),
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        transporter.verify(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("timeout")), 20_000);
        }),
      ]);
      return { success: true };
    } catch {
      throw new BadRequestException(
        "SMTP connection failed. Check the host, port, security mode and credentials.",
      );
    } finally {
      if (timeout) clearTimeout(timeout);
      transporter.close();
    }
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
          secure: settings.smtpSecure ?? settings.smtpPort === 465,
          user: settings.smtpUser ?? undefined,
          pass: settings.smtpPassCiphertext
            ? decryptSecret(settings.smtpPassCiphertext)
            : undefined,
          from: settings.smtpFrom ?? undefined,
        }
      : null;
  }
}
