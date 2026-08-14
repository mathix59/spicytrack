import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InstanceAdminService } from "../instance-admin/instance-admin.service";
import { createTransport } from "nodemailer";
import type { Transporter } from "nodemailer";

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private from = "noreply@spicytrack.local";

  constructor(private readonly instanceAdmin: InstanceAdminService) {}

  async onModuleInit(): Promise<void> {
    const configured = await this.instanceAdmin.smtpConfig();
    const host = configured?.host;
    this.from = configured?.from ?? this.from;

    if (!host) {
      this.logger.log("SMTP is not configured, using console email transport");
      return;
    }

    this.transporter = createTransport({
      host,
      port: configured.port,
      auth: {
        user: configured.user,
        pass: configured.pass,
      },
    });
  }

  async send(input: { to: string; subject: string; text: string }): Promise<void> {
    const configured = await this.instanceAdmin.smtpConfig();
    const transporter = configured
      ? createTransport({
          host: configured.host,
          port: configured.port,
          auth: { user: configured.user, pass: configured.pass },
        })
      : this.transporter;
    if (!transporter) {
      this.logger.log(`[console email] to=${input.to} subject="${input.subject}"\n${input.text}`);
      return;
    }

    await transporter.sendMail({
      from: configured?.from ?? this.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
  }

  async checkHealth(): Promise<"ok" | "disabled"> {
    const configured = await this.instanceAdmin.smtpConfig();
    if (!configured?.host) return "disabled";
    const transporter = createTransport({
      host: configured.host,
      port: configured.port,
      auth: { user: configured.user, pass: configured.pass },
    });
    await transporter.verify();
    return "ok";
  }
}
