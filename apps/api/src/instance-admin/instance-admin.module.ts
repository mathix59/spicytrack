import { DeleteUserService } from "./delete-user.service";
import { Module } from "@nestjs/common";
import { InstanceAdminController } from "./instance-admin.controller";
import { InstanceAdminService } from "./instance-admin.service";
import { UpdateCheckService } from "./update-check.service";
@Module({
  controllers: [InstanceAdminController],
  providers: [InstanceAdminService, UpdateCheckService, DeleteUserService],
  exports: [InstanceAdminService],
})
export class InstanceAdminModule {}
