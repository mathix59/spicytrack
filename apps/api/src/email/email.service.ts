import { Injectable, Logger } from "@nestjs/common";
import { InstanceAdminService } from "../instance-admin/instance-admin.service";
import { createTransport } from "nodemailer";
import { smtpTransportOptions } from "./smtp-options";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly instanceAdmin: InstanceAdminService) {}

  async send(input: { to: string; subject: string; text: string }): Promise<void> {
    const configured = await this.instanceAdmin.smtpConfig();
    if (!configured) {
      this.logger.log(`[console email] to=${input.to} subject="${input.subject}"\n${input.text}`);
      return;
    }
    const transporter = createTransport(smtpTransportOptions(configured));
    await transporter.sendMail({ from: configured.from ?? "noreply@spicytrack.local", ...input });
  }

  async checkHealth(): Promise<"ok" | "disabled"> {
    const configured = await this.instanceAdmin.smtpConfig();
    if (!configured) return "disabled";
    const transporter = createTransport(smtpTransportOptions(configured));
    await transporter.verify();
    return "ok";
  }
}
