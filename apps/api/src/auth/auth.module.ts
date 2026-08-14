import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { BetterAuthLifecycleService } from "./better-auth-lifecycle.service";
import { InstanceAdminModule } from "../instance-admin/instance-admin.module";

@Module({
  imports: [InstanceAdminModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, BetterAuthLifecycleService],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
