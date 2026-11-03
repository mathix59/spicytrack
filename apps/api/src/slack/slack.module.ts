import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IssuesModule } from "../issues/issues.module";
import { RbacModule } from "../rbac/rbac.module";
import { SlackInteractionsController } from "./slack-interactions.controller";
import { SlackSettingsController } from "./slack.controller";
import { SlackService } from "./slack.service";

@Module({
  imports: [AuditModule, IssuesModule, RbacModule],
  controllers: [SlackSettingsController, SlackInteractionsController],
  providers: [SlackService],
})
export class SlackModule {}
