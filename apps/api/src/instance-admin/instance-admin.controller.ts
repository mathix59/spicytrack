import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/current-user.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { EndpointAccess } from "../auth/endpoint-access.decorator";
import { InstanceAdminService } from "./instance-admin.service";

@UseGuards(AuthGuard)
@EndpointAccess("instance-admin")
@Controller("instance-admin")
export class InstanceAdminController {
  constructor(private readonly service: InstanceAdminService) {}
  @Get("settings") async get(@CurrentUser() user: { id: string }) {
    await this.service.assertSuperAdmin(user.id);
    return this.service.get();
  }
  @Patch("settings") async update(
    @CurrentUser() user: { id: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.update(user.id, body as Parameters<InstanceAdminService["update"]>[1]);
  }
  @Get("users") async users(
    @CurrentUser() user: { id: string },
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.service.listUsers(
      user.id,
      search ?? "",
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(pageSize) || 20)),
    );
  }
  @Patch("users/:userId") async updateUser(
    @CurrentUser() user: { id: string },
    @Param("userId") userId: string,
    @Body() body: { isSuperAdmin: boolean },
  ) {
    return this.service.setSuperAdmin(user.id, userId, body.isSuperAdmin);
  }
}
