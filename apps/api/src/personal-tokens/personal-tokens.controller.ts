import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { assertString, optionalNumber } from "../common/validators";
import {
  CreatePersonalAccessTokenBodyDto,
  CreatePersonalAccessTokenResponseDto,
  PersonalAccessTokenDto,
  SuccessDto,
} from "../openapi/contracts";
import { PersonalTokensService } from "./personal-tokens.service";

@ApiTags("personal-tokens")
@ApiBearerAuth()
@Controller("auth/tokens")
@UseGuards(AuthGuard)
export class PersonalTokensController {
  constructor(private readonly personalTokensService: PersonalTokensService) {}

  @Get()
  @ApiOperation({ operationId: "listPersonalAccessTokens" })
  @ApiOkResponse({ type: [PersonalAccessTokenDto] })
  async list(@CurrentUser() user: { id: string }) {
    return this.personalTokensService.list(user.id);
  }

  @Post()
  @ApiOperation({ operationId: "createPersonalAccessToken" })
  @ApiBody({ type: CreatePersonalAccessTokenBodyDto })
  @ApiOkResponse({ type: CreatePersonalAccessTokenResponseDto })
  async create(@CurrentUser() user: { id: string }, @Body() body: Record<string, unknown>) {
    return this.personalTokensService.create({
      userId: user.id,
      name: assertString(body.name, "name"),
      expiresInDays: optionalNumber(body.expiresInDays, "expiresInDays") ?? undefined,
    });
  }

  @Delete(":tokenId")
  @ApiOperation({ operationId: "revokePersonalAccessToken" })
  @ApiParam({ name: "tokenId", type: String })
  @ApiOkResponse({ type: SuccessDto })
  async revoke(@CurrentUser() user: { id: string }, @Param("tokenId") tokenId: string) {
    return this.personalTokensService.revoke({ userId: user.id, tokenId });
  }
}
