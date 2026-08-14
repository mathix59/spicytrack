import { Body, Controller, Headers, Param, Post, Query, Req } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { EndpointAccess } from "../auth/endpoint-access.decorator";
import { IngestAcceptedDto, SentryEventBodyDto } from "../openapi/contracts";
import { IngestService } from "./ingest.service";

@ApiTags("ingest")
@ApiParam({ name: "projectId", type: String })
@EndpointAccess("project-key")
@Controller(":projectId")
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post("store")
  @ApiOperation({ operationId: "ingestStoreEvent" })
  @ApiBody({ type: SentryEventBodyDto })
  @ApiQuery({ name: "sentry_key", required: false, type: String })
  @ApiOkResponse({ type: IngestAcceptedDto })
  async store(
    @Param("projectId") projectId: string,
    @Body() body: Record<string, unknown>,
    @Query("sentry_key") sentryKeyQuery: string | undefined,
    @Headers("x-sentry-auth") sentryAuthHeader: string | undefined,
  ) {
    return this.ingestService.ingestStore(
      projectId,
      body,
      sentryKeyQuery ?? parseSentryAuthHeader(sentryAuthHeader),
    );
  }

  @Post("envelope")
  @ApiOperation({ operationId: "ingestEnvelopeEvent" })
  @ApiQuery({ name: "sentry_key", required: false, type: String })
  @ApiOkResponse({ type: IngestAcceptedDto })
  async envelope(
    @Param("projectId") projectId: string,
    @Req() request: FastifyRequest<{ Body: string }>,
    @Query("sentry_key") sentryKeyQuery: string | undefined,
    @Headers("x-sentry-auth") sentryAuthHeader: string | undefined,
  ) {
    const rawEnvelope =
      typeof request.body === "string" ? request.body : JSON.stringify(request.body);

    return this.ingestService.ingestEnvelope(
      projectId,
      rawEnvelope,
      sentryKeyQuery ??
        parseSentryAuthHeader(sentryAuthHeader) ??
        parseSentryAuthHeader(request.headers["sentry-auth"] as string | undefined),
    );
  }
}

function parseSentryAuthHeader(value?: string) {
  if (!value) {
    return undefined;
  }

  const match = value.match(/sentry_key=([^,]+)/);
  return match?.[1];
}
