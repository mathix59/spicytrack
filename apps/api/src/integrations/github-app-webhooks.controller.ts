import { Body, Controller, Headers, Post, Req } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { EndpointAccess } from "../auth/endpoint-access.decorator";
import { IntegrationsService } from "./integrations.service";

@ApiExcludeController()
@EndpointAccess("github-signature")
@Controller("github-app/webhooks")
export class GithubAppWebhooksController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post()
  async handle(
    @Body() body: unknown,
    @Req() request: FastifyRequest & { rawBody?: Buffer | string },
    @Headers("x-github-event") event: string | undefined,
    @Headers("x-hub-signature-256") signature: string | undefined,
  ) {
    const rawBodyValue = request.rawBody;
    const rawBody =
      typeof rawBodyValue === "string"
        ? rawBodyValue
        : rawBodyValue instanceof Buffer
          ? rawBodyValue.toString("utf8")
          : typeof body === "string"
            ? body
            : body instanceof Buffer
              ? body.toString("utf8")
              : JSON.stringify(body ?? {});

    return this.integrationsService.handleGithubAppWebhook({
      event,
      signature,
      rawBody,
    });
  }
}
