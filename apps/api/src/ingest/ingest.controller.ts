import { Body, Controller, Headers, Param, Post, Query, Req, Res } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";
import { EndpointAccess } from "../auth/endpoint-access.decorator";
import { IngestAcceptedDto, SentryEventBodyDto } from "../openapi/contracts";
import { IngestQuotaExceededException } from "./ingest-quotas.service";
import { IngestService } from "./ingest.service";

/** Adds the rate-limit headers SDKs use to back off when a quota rejects the event. */
async function withRateLimitHeaders<T>(reply: FastifyReply, ingest: () => Promise<T>) {
  try {
    return await ingest();
  } catch (error) {
    if (error instanceof IngestQuotaExceededException) reply.headers(error.headers);
    throw error;
  }
}

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
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return withRateLimitHeaders(reply, () =>
      this.ingestService.ingestStore(
        projectId,
        body,
        sentryKeyQuery ?? parseSentryAuthHeader(sentryAuthHeader),
      ),
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
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const rawEnvelope =
      typeof request.body === "string" ? request.body : JSON.stringify(request.body);

    return withRateLimitHeaders(reply, () =>
      this.ingestService.ingestEnvelope(
        projectId,
        rawEnvelope,
        sentryKeyQuery ??
          parseSentryAuthHeader(sentryAuthHeader) ??
          parseSentryAuthHeader(request.headers["sentry-auth"] as string | undefined),
      ),
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
