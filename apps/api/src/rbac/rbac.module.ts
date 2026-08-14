import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { OrganizationContextGuard } from "./organization-context.guard";
import { PermissionGuard } from "./permission.guard";
import { PermissionService } from "./permission.service";

@Module({
  providers: [Reflector, PermissionService, OrganizationContextGuard, PermissionGuard],
  exports: [PermissionService, OrganizationContextGuard, PermissionGuard],
})
export class RbacModule {}
