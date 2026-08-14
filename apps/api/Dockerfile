# Build the TypeScript application on the native runner architecture. The
# generated JavaScript is architecture-independent, so Node and pnpm never need
# to run through QEMU during a multi-platform build.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build-base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM build-base AS deps
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY . .
RUN pnpm --filter api build

# Docker selects TARGETPLATFORM for the final image automatically. Runtime API
# dependencies are architecture-independent; native packages in this workspace
# are build-only tooling and are never executed by the application.
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache git
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/api/drizzle.config.ts ./apps/api/drizzle.config.ts
EXPOSE 3000
USER 1000

FROM runner AS api-web
CMD ["node", "apps/api/dist/src/main.js"]

FROM runner AS api-ingest
CMD ["node", "apps/api/dist/src/main-ingest.js"]

FROM runner AS api-worker-admin
CMD ["node", "apps/api/dist/src/main-worker-admin.js"]
