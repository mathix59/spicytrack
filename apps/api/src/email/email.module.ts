import { Module } from "@nestjs/common";
import { EmailService } from "./email.service";
import { InstanceAdminModule } from "../instance-admin/instance-admin.module";

@Module({
  imports: [InstanceAdminModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
