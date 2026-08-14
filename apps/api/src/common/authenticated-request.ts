import type { FastifyRequest } from "fastify";
import { RequestContext } from "./request-context";

export type AuthenticatedRequest = FastifyRequest<{
  Params: Record<string, string | string[]>;
}> &
  RequestContext;
