import { Controller, Headers, HttpCode, Post, Req } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { EndpointAccess } from "../auth/endpoint-access.decorator";
import { SlackService } from "./slack.service";

/** Slack app Request URL: button clicks in alert messages, signed with the app's secret. */
@ApiExcludeController()
@EndpointAccess("slack-signature")
@Controller("slack/interactions")
export class SlackInteractionsController {
  constructor(private readonly slackService: SlackService) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Req() request: FastifyRequest & { rawBody?: Buffer | string },
    @Headers("x-slack-request-timestamp") timestamp: string | undefined,
    @Headers("x-slack-signature") signature: string | undefined,
  ) {
    const rawBody =
      typeof request.rawBody === "string"
        ? request.rawBody
        : request.rawBody instanceof Buffer
          ? request.rawBody.toString("utf8")
          : "";
    const work = await this.slackService.acceptInteraction({ rawBody, timestamp, signature });
    // Answer Slack now; the issue update and the message refresh follow.
    if (work) void work();
    return {};
  }
}
