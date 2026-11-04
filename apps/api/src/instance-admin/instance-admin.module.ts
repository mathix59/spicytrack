import { DeleteUserService } from "./delete-user.service";
import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { InstanceAdminController } from "./instance-admin.controller";
import { InstanceAdminService } from "./instance-admin.service";
import { UpdateCheckService } from "./update-check.service";
import { SmtpTestEmailService } from "./smtp-test-email.service";
import { EmailService } from "../email/email.service";
@Module({
  imports: [AuditModule],
  controllers: [InstanceAdminController],
  // EmailService is provided here too: EmailModule already imports this module.
  providers: [
    InstanceAdminService,
    UpdateCheckService,
    DeleteUserService,
    EmailService,
    SmtpTestEmailService,
  ],
  exports: [InstanceAdminService],
})
export class InstanceAdminModule {}
