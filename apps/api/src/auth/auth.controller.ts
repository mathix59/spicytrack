import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/current-user.decorator";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { MeResponseDto } from "../openapi/contracts";
import { InstanceAdminService } from "../instance-admin/instance-admin.service";
import { publicAuthenticationOptions } from "./oidc-config";
import { EndpointAccess } from "./endpoint-access.decorator";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly instanceAdmin: InstanceAdminService,
  ) {}

  @Get("registration-status")
  @EndpointAccess("public")
  async registrationStatus() {
    const settings = await this.instanceAdmin.get();
    return {
      registrationsEnabled: settings.registrationsEnabled,
      ...publicAuthenticationOptions(),
    };
  }

  @UseGuards(AuthGuard)
  @Get("me")
  @ApiOperation({ operationId: "getMe" })
  @ApiBearerAuth()
  @ApiOkResponse({ type: MeResponseDto })
  async me(@CurrentUser() user: { id: string }) {
    return this.authService.getProfile(user.id);
  }
}
