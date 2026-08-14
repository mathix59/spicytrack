import { Inject, Injectable, Logger } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import path from "node:path";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { releaseArtifacts } from "../database/schema";
import { STORAGE_SERVICE } from "../storage/storage.service";
import type { StorageService } from "../storage/storage.service";
import type { RawStackFrame } from "../common/grouping";
import {
  parseDartObfuscationMap,
  parseProguardMap,
  resolveDartFrame,
  resolveProguardFrame,
} from "./managed-symbol-maps";

export type FrameResolution = "sourcemap" | "proguard" | "dart_obfuscation" | "original";

export interface ResolvedFrame {
  filename: string;
  function?: string | null;
  lineno: number;
  colno?: number | null;
  resolved: boolean;
  resolution: FrameResolution;
  diagnostic:
    | "resolved"
    | "already_readable"
    | "no_release"
    | "no_artifacts"
    | "missing_location"
    | "artifact_not_found"
    | "sourcemap_not_found"
    | "unsupported_sourcemap"
    | "invalid_sourcemap"
    | "position_not_found"
    | "resolution_error";
}

const SOURCE_MAPPING_URL_RE = /\/\/# sourceMappingURL=(\S+)/;

type Artifact = typeof releaseArtifacts.$inferSelect;

const PROGUARD_ARTIFACT_RE = /(?:^|\/)(?:mapping\.txt|proguard(?:-mapping)?\.txt)$/i;
const DART_MAP_ARTIFACT_RE = /(?:^|\/)(?:dart-)?obfuscation(?:-map)?\.json$/i;

function sdkFamily(input: { sdkName?: string | null; platform?: string | null }) {
  const sdkName = input.sdkName?.toLowerCase() ?? "";
  const platform = input.platform?.toLowerCase() ?? "";
  if (
    sdkName.startsWith("sentry.javascript.browser") ||
    sdkName.startsWith("sentry.javascript.react")
  )
    return "browser";
  if (sdkName.startsWith("sentry.javascript.")) return "javascript";
  if (sdkName.startsWith("sentry.java") || platform === "java") return "java";
  if (sdkName.startsWith("sentry.dart") || platform === "dart") return "dart";
  if (sdkName || platform) return "readable";
  return "unknown";
}

function canonicalArtifactPath(value: string): string {
  let candidate = value.trim().replaceAll("\\", "/");
  try {
    const url = new URL(candidate);
    candidate = url.pathname;
  } catch {
    candidate = candidate.split(/[?#]/, 1)[0];
  }
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    // Keep malformed percent-encoding matchable instead of failing resolution.
  }
  candidate = candidate.replace(/^(?:webpack|app):\/+/i, "");
  candidate = candidate.replace(/^~\//, "").replace(/^\.\//, "").replace(/^\/+/, "");
  return path.posix.normalize(candidate);
}

function findArtifact(value: string, artifacts: Artifact[]): Artifact | null {
  const target = canonicalArtifactPath(value);
  const exact = artifacts.filter((artifact) => canonicalArtifactPath(artifact.name) === target);
  if (exact.length === 1) return exact[0];

  const suffix = artifacts.filter((artifact) => {
    const artifactPath = canonicalArtifactPath(artifact.name);
    return artifactPath.endsWith(`/${target}`) || target.endsWith(`/${artifactPath}`);
  });
  if (suffix.length === 1) return suffix[0];

  const basename = path.posix.basename(target);
  const basenameMatches = artifacts.filter(
    (artifact) => path.posix.basename(canonicalArtifactPath(artifact.name)) === basename,
  );
  return basenameMatches.length === 1 ? basenameMatches[0] : null;
}

@Injectable()
export class SourcemapResolverService {
  private readonly logger = new Logger(SourcemapResolverService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  async resolveFrames(input: {
    releaseId: string | null;
    frames: RawStackFrame[];
    sdkName?: string | null;
    platform?: string | null;
  }): Promise<ResolvedFrame[]> {
    if (input.frames.length === 0) return [];
    const family = sdkFamily(input);
    if (!input.releaseId) {
      return family === "browser" || family === "unknown"
        ? input.frames.map((frame) => this.toUnresolved(frame, "no_release", "sourcemap"))
        : input.frames.map((frame) => this.toOriginal(frame));
    }

    const artifacts = await this.db
      .select()
      .from(releaseArtifacts)
      .where(eq(releaseArtifacts.releaseId, input.releaseId))
      .orderBy(desc(releaseArtifacts.createdAt));

    if (artifacts.length === 0) {
      return family === "browser" || family === "unknown"
        ? input.frames.map((frame) => this.toUnresolved(frame, "no_artifacts", "sourcemap"))
        : input.frames.map((frame) => this.toOriginal(frame));
    }

    const proguardArtifact = artifacts.find((artifact) =>
      PROGUARD_ARTIFACT_RE.test(canonicalArtifactPath(artifact.name)),
    );
    if (family === "java" && proguardArtifact) {
      return this.resolveProguardFrames(input.frames, proguardArtifact);
    }

    const dartMapArtifact = artifacts.find((artifact) =>
      DART_MAP_ARTIFACT_RE.test(canonicalArtifactPath(artifact.name)),
    );
    if (family === "dart" && dartMapArtifact) {
      return this.resolveDartFrames(input.frames, dartMapArtifact);
    }

    const hasSourceMap = artifacts.some((artifact) =>
      canonicalArtifactPath(artifact.name).endsWith(".map"),
    );
    if (
      family !== "browser" &&
      family !== "unknown" &&
      !((family === "javascript" || family === "readable") && hasSourceMap)
    ) {
      return input.frames.map((frame) => this.toOriginal(frame));
    }

    const traceMapCache = new Map<string, TraceMap | null>();

    const results: ResolvedFrame[] = [];
    for (const frame of input.frames) {
      results.push(await this.resolveFrame(frame, artifacts, traceMapCache));
    }
    return results;
  }

  private toUnresolved(
    frame: RawStackFrame,
    diagnostic: Exclude<ResolvedFrame["diagnostic"], "resolved">,
    resolution: Exclude<FrameResolution, "original"> = "sourcemap",
  ): ResolvedFrame {
    return {
      filename: frame.filename ?? frame.absPath ?? frame.module ?? "unknown",
      function: frame.function,
      lineno: frame.lineno ?? 0,
      colno: frame.colno,
      resolved: false,
      resolution,
      diagnostic,
    };
  }

  private toOriginal(frame: RawStackFrame): ResolvedFrame {
    return {
      filename: frame.filename ?? frame.absPath ?? frame.module ?? "unknown",
      function: frame.function,
      lineno: frame.lineno ?? 0,
      colno: frame.colno,
      resolved: true,
      resolution: "original",
      diagnostic: "already_readable",
    };
  }

  private async resolveFrame(
    frame: RawStackFrame,
    artifacts: Artifact[],
    traceMapCache: Map<string, TraceMap | null>,
  ): Promise<ResolvedFrame> {
    const framePath = frame.absPath ?? frame.filename;
    const unresolved = (diagnostic: Exclude<ResolvedFrame["diagnostic"], "resolved">) =>
      this.toUnresolved(frame, diagnostic);

    if (!framePath || frame.lineno == null) return unresolved("missing_location");

    try {
      const jsArtifact = findArtifact(framePath, artifacts);
      const mapResult = await this.findMapArtifact(framePath, jsArtifact, artifacts);
      if (!mapResult.artifact) return unresolved(mapResult.diagnostic);
      const mapArtifact = mapResult.artifact;

      let traceMap = traceMapCache.get(mapArtifact.storageKey);
      if (traceMap === undefined) {
        traceMap = await this.loadTraceMap(mapArtifact.storageKey);
        traceMapCache.set(mapArtifact.storageKey, traceMap);
      }

      if (!traceMap) return unresolved("invalid_sourcemap");

      const original = originalPositionFor(traceMap, {
        line: frame.lineno,
        column: frame.colno ?? 0,
      });

      if (!original.source || original.line == null) return unresolved("position_not_found");

      return {
        filename: original.source,
        function: original.name ?? frame.function,
        lineno: original.line,
        colno: original.column,
        resolved: true,
        resolution: "sourcemap",
        diagnostic: "resolved",
      };
    } catch (error) {
      this.logger.warn(
        `Sourcemap resolution failed for frame ${framePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return unresolved("resolution_error");
    }
  }

  private async resolveProguardFrames(
    frames: RawStackFrame[],
    artifact: Artifact,
  ): Promise<ResolvedFrame[]> {
    try {
      const bytes = await this.storageService.getObject(artifact.storageKey);
      const mapping = parseProguardMap(bytes.toString("utf8"));
      return frames.map((frame) => {
        const resolved = resolveProguardFrame(frame, mapping);
        return resolved
          ? {
              ...resolved,
              resolved: true,
              resolution: "proguard" as const,
              diagnostic: "resolved" as const,
            }
          : this.toOriginal(frame);
      });
    } catch (error) {
      this.logger.warn(
        `Could not parse ProGuard mapping ${artifact.storageKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return frames.map((frame) => this.toUnresolved(frame, "invalid_sourcemap", "proguard"));
    }
  }

  private async resolveDartFrames(
    frames: RawStackFrame[],
    artifact: Artifact,
  ): Promise<ResolvedFrame[]> {
    try {
      const bytes = await this.storageService.getObject(artifact.storageKey);
      const mapping = parseDartObfuscationMap(bytes.toString("utf8"));
      return frames.map((frame) => {
        const resolved = resolveDartFrame(frame, mapping);
        return resolved
          ? {
              ...resolved,
              resolved: true,
              resolution: "dart_obfuscation" as const,
              diagnostic: "resolved" as const,
            }
          : this.toOriginal(frame);
      });
    } catch (error) {
      this.logger.warn(
        `Could not parse Dart obfuscation map ${artifact.storageKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return frames.map((frame) =>
        this.toUnresolved(frame, "invalid_sourcemap", "dart_obfuscation"),
      );
    }
  }

  private async findMapArtifact(
    framePath: string,
    jsArtifact: Artifact | null,
    artifacts: Artifact[],
  ): Promise<{
    artifact: Artifact | null;
    diagnostic: "artifact_not_found" | "sourcemap_not_found" | "unsupported_sourcemap";
  }> {
    const direct = findArtifact(`${canonicalArtifactPath(framePath)}.map`, artifacts);
    if (direct) return { artifact: direct, diagnostic: "sourcemap_not_found" };
    if (!jsArtifact) return { artifact: null, diagnostic: "artifact_not_found" };

    const jsBytes = await this.storageService.getObject(jsArtifact.storageKey);
    const tail = jsBytes.subarray(Math.max(0, jsBytes.length - 500)).toString("utf8");
    const match = SOURCE_MAPPING_URL_RE.exec(tail);
    if (!match) return { artifact: null, diagnostic: "sourcemap_not_found" };

    const reference = match[1];
    if (reference.startsWith("data:")) {
      return { artifact: null, diagnostic: "unsupported_sourcemap" };
    }

    const jsPath = canonicalArtifactPath(jsArtifact.name);
    const referencedPath = /^https?:\/\//.test(reference)
      ? canonicalArtifactPath(reference)
      : path.posix.join(path.posix.dirname(jsPath), reference);
    return {
      artifact: findArtifact(referencedPath, artifacts),
      diagnostic: "sourcemap_not_found",
    };
  }

  private async loadTraceMap(storageKey: string): Promise<TraceMap | null> {
    try {
      const bytes = await this.storageService.getObject(storageKey);
      return new TraceMap(bytes.toString("utf8"));
    } catch (error) {
      this.logger.warn(
        `Could not parse sourcemap at ${storageKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
