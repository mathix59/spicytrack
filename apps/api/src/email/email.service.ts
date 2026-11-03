import { renderEmail } from "./email-template";
import { Injectable, Logger } from "@nestjs/common";
import { InstanceAdminService } from "../instance-admin/instance-admin.service";
import { createTransport } from "nodemailer";
import { smtpTransportOptions } from "./smtp-options";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly instanceAdmin: InstanceAdminService) {}

  /**
   * Sends the email, or only logs it when no SMTP server is configured (development).
   * Returns which of the two happened so callers can report undelivered mail honestly.
   */
  async send(input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<"sent" | "logged"> {
    const configured = await this.instanceAdmin.smtpConfig();
    if (!configured) {
      this.logger.log(`[console email] to=${input.to} subject="${input.subject}"\n${input.text}`);
      return "logged";
    }
    const transporter = createTransport(smtpTransportOptions(configured));
    try {
      await transporter.sendMail({
        from: configured.from ?? "noreply@spicytrack.local",
        ...input,
        html:
          input.html ??
          renderEmail({
            subject: input.subject,
            eyebrow: "Activity notification",
            title: input.subject,
            paragraphs: [input.text],
          }).html,
      });
    } finally {
      transporter.close();
    }
    return "sent";
  }
}
