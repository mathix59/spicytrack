import { Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";
import { InstanceAdminService } from "../instance-admin/instance-admin.service";
import { createTransport } from "nodemailer";
import { smtpTransportOptions } from "./smtp-options";

type SmtpConfig = NonNullable<Awaited<ReturnType<InstanceAdminService["smtpConfig"]>>>;
type SmtpHealth = { key: string; status: "checking" | "ok" | "error"; checkedAt: number };
const HEALTH_CACHE_MS = 60_000;
const HEALTH_TIMEOUT_MS = 20_000;

function configKey(config: SmtpConfig) {
  return createHash("sha256")
    .update(JSON.stringify(smtpTransportOptions(config)))
    .digest("hex");
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private health?: SmtpHealth;

  constructor(private readonly instanceAdmin: InstanceAdminService) {}

  async send(input: { to: string; subject: string; text: string }): Promise<void> {
    const configured = await this.instanceAdmin.smtpConfig();
    if (!configured) {
      this.logger.log(`[console email] to=${input.to} subject="${input.subject}"\n${input.text}`);
      return;
    }
    const transporter = createTransport(smtpTransportOptions(configured));
    try {
      await transporter.sendMail({ from: configured.from ?? "noreply@spicytrack.local", ...input });
      // A delivered message is stronger evidence than an independent verification probe.
      // Replace the record so an older probe cannot overwrite this success.
      this.health = { key: configKey(configured), status: "ok", checkedAt: Date.now() };
    } finally {
      transporter.close();
    }
  }

  async checkHealth(): Promise<"checking" | "ok" | "error" | "disabled"> {
    const configured = await this.instanceAdmin.smtpConfig();
    if (!configured) {
      this.health = undefined;
      return "disabled";
    }
    const key = configKey(configured);
    if (
      !this.health ||
      this.health.key !== key ||
      Date.now() - this.health.checkedAt >= HEALTH_CACHE_MS
    ) {
      const health: SmtpHealth = { key, status: "checking", checkedAt: Date.now() };
      this.health = health;
      // Do not perform an SMTP handshake on the HTTP readiness request's critical path.
      void this.verifyHealth(configured, health);
    }
    return this.health.status;
  }

  private async verifyHealth(config: SmtpConfig, health: SmtpHealth): Promise<void> {
    let transporter: ReturnType<typeof createTransport> | undefined;
    let timeout: NodeJS.Timeout | undefined;
    try {
      transporter = createTransport({
        ...smtpTransportOptions(config),
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 10_000,
      });
      await Promise.race([
        transporter.verify(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("SMTP health check timed out")),
            HEALTH_TIMEOUT_MS,
          );
          timeout.unref();
        }),
      ]);
      health.status = "ok";
    } catch (error) {
      health.status = "error";
      // Log the diagnostic code, never SMTP credentials or a provider's raw response.
      const code = (error as { code?: unknown } | null)?.code;
      this.logger.warn(
        `SMTP health verification failed (${typeof code === "string" ? code : "verification error or timeout"})`,
      );
    } finally {
      if (timeout) clearTimeout(timeout);
      transporter?.close();
      health.checkedAt = Date.now();
    }
  }
}
