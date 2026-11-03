import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AccessResolver } from "./access-resolver.service";
import { OrganizationContextGuard } from "./organization-context.guard";
import { PermissionGuard } from "./permission.guard";
import { PermissionService } from "./permission.service";

@Module({
  providers: [
    Reflector,
    PermissionService,
    AccessResolver,
    OrganizationContextGuard,
    PermissionGuard,
  ],
  exports: [PermissionService, AccessResolver, OrganizationContextGuard, PermissionGuard],
})
export class RbacModule {}
