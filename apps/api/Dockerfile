# Build the TypeScript application on the native runner architecture. The
# generated JavaScript is architecture-independent, so Node and pnpm never need
# to run through QEMU during a multi-platform build.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build-base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM build-base AS build-deps
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

FROM build-deps AS build
WORKDIR /app
COPY . .
RUN pnpm --filter api build

FROM build-base AS runtime-deps
ARG TARGETARCH
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
RUN case "$TARGETARCH" in \
      amd64) target_cpu=x64 ;; \
      arm64) target_cpu=arm64 ;; \
      *) echo "Unsupported target architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac \
    && pnpm config set --location=project --json supportedArchitectures "{\"os\":[\"linux\"],\"cpu\":[\"$target_cpu\"],\"libc\":[\"musl\"]}" \
    && pnpm install --prod --ignore-scripts --frozen-lockfile

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache git
COPY --from=runtime-deps /app/node_modules ./node_modules
COPY --from=runtime-deps /app/package.json ./package.json
COPY --from=runtime-deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=runtime-deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=runtime-deps /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=runtime-deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=runtime-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/api/drizzle.config.ts ./apps/api/drizzle.config.ts
RUN node -e 'const fs = require("node:fs"); const path = require("node:path"); if (!fs.existsSync("apps/api/node_modules/drizzle-kit/bin.cjs")) throw new Error("drizzle-kit is required by the Helm migration job"); const packages = fs.readdirSync("node_modules/.pnpm"); const wrongArch = process.arch === "arm64" ? /linux-x64/ : /linux-arm64/; const mismatches = packages.filter((name) => wrongArch.test(name)); if (mismatches.length) throw new Error(`Found packages for the wrong architecture: ${mismatches.join(", ")}`); const addons = []; const walk = (dir) => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else if (entry.isFile() && file.endsWith(".node")) addons.push(path.resolve(file)); } }; walk("node_modules"); for (const addon of addons) require(addon); console.log(`Validated runtime dependencies for ${process.arch}`);'
EXPOSE 3000
USER 1000

FROM runner AS api-web
CMD ["node", "apps/api/dist/src/main.js"]

FROM runner AS api-ingest
CMD ["node", "apps/api/dist/src/main-ingest.js"]

FROM runner AS api-worker-admin
CMD ["node", "apps/api/dist/src/main-worker-admin.js"]
