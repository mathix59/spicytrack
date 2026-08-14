import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";

import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { projects } from "../database/schema";
import { normalizeBrowserIngestOrigin } from "./browser-ingest-origins";

const INGEST_ROUTE = /^\/api\/(\d+)\/(?:store|envelope)\/?$/;

@Injectable()
export class BrowserIngestCorsService {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  async optionsFor(request: FastifyRequest) {
    const requestOrigin = request.headers.origin;
    if (!requestOrigin) return { origin: false };

    const pathname = request.url.split("?", 1)[0];
    const match = pathname.match(INGEST_ROUTE);
    const publicId = Number(match?.[1]);
    if (!Number.isSafeInteger(publicId) || publicId < 1) return { origin: false };

    const [project] = await this.db
      .select({ browserAllowedOrigins: projects.browserAllowedOrigins })
      .from(projects)
      .where(eq(projects.publicId, publicId))
      .limit(1);
    if (!project) return { origin: false };

    const allowedOrigins = project.browserAllowedOrigins as string[];
    let normalizedRequestOrigin: string;
    try {
      normalizedRequestOrigin = normalizeBrowserIngestOrigin(requestOrigin);
    } catch {
      return { origin: false };
    }

    const allowed = allowedOrigins.length === 0 || allowedOrigins.includes(normalizedRequestOrigin);

    return {
      origin: allowed ? normalizedRequestOrigin : false,
      credentials: false,
      methods: ["POST", "OPTIONS"],
      maxAge: 600,
    };
  }
}
