import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DATABASE, primaryDatabase, type DatabaseClient } from "../database/database.provider";
import { users } from "../database/schema";
import { smtpTestEmail } from "../email/email-template";
import { EmailService } from "../email/email.service";
import { InstanceAdminService } from "./instance-admin.service";

/** Sends a real email with the saved SMTP settings to the requesting administrator. */
@Injectable()
export class SmtpTestEmailService {
  private readonly db: DatabaseClient;

  constructor(
    @Inject(DATABASE) database: DatabaseClient,
    private readonly instanceAdmin: InstanceAdminService,
    private readonly email: EmailService,
  ) {
    this.db = primaryDatabase(database);
  }

  async send(userId: string) {
    await this.instanceAdmin.assertSuperAdmin(userId);
    const [user] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new NotFoundException("User not found");

    let outcome: "sent" | "logged";
    try {
      outcome = await this.email.send({ to: user.email, ...smtpTestEmail() });
    } catch {
      throw new BadRequestException(
        "The test email could not be delivered. Check the saved host, port, security mode and credentials.",
      );
    }
    if (outcome !== "sent") {
      throw new BadRequestException("Save SMTP settings before sending a test email.");
    }
    return { success: true, to: user.email };
  }
}
