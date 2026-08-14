import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";

interface RegisteredRoute {
  method: string;
  url: string;
}

const UNAUTHENTICATED_ROUTES = [
  /^\/api\/?$/,
  /^\/api\/health(?:\/live|\/ready)?$/,
  /^\/api\/metrics$/,
  /^\/api\/auth\/registration-status$/,
  /^\/api\/:projectId\/(?:store|envelope)$/,
  /^\/api\/github-app\/webhooks$/,
  /^\/api\/mcp$/,
];

function materializePath(url: string): string {
  return url.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_match, name: string) => `test-${name}`);
}

describe("endpoint authentication boundary (e2e)", () => {
  let app: NestFastifyApplication;
  const registeredRoutes: RegisteredRoute[] = [];

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const adapter = new FastifyAdapter();
    adapter.getInstance().addHook("onRoute", (route) => {
      const methods = Array.isArray(route.method) ? route.method : [route.method];
      for (const method of methods) registeredRoutes.push({ method, url: route.url });
    });
    app = moduleFixture.createNestApplication<NestFastifyApplication>(adapter);
    app.setGlobalPrefix("api");
    await app.init();
    await adapter.getInstance().ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it("rejects an anonymous request on every session-authenticated endpoint", async () => {
    const protectedRoutes = registeredRoutes
      .filter(({ method }) => !["HEAD", "OPTIONS"].includes(method))
      .filter(({ url }) => !UNAUTHENTICATED_ROUTES.some((pattern) => pattern.test(url)))
      .filter(
        (route, index, routes) =>
          routes.findIndex(
            (candidate) => candidate.method === route.method && candidate.url === route.url,
          ) === index,
      );

    // Kept in sync with the source-level endpoint security contract.
    expect(protectedRoutes).toHaveLength(106);

    const violations: string[] = [];
    for (const route of protectedRoutes) {
      const response = await app.inject({
        method: route.method as "GET",
        url: materializePath(route.url),
      });
      if (response.statusCode !== 401) {
        violations.push(`${route.method} ${route.url}: expected 401, got ${response.statusCode}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
