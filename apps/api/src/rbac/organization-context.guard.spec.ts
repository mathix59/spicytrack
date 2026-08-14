import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { OrganizationContextGuard } from "./organization-context.guard";

function createContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

function createDatabase(rows: unknown[]) {
  return {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        innerJoin: jest.fn(() => ({
          where: jest.fn(() => ({ limit: jest.fn(async () => rows) })),
        })),
      })),
    })),
  };
}

describe("OrganizationContextGuard", () => {
  it("attaches only an organization joined through the authenticated membership", async () => {
    const row = {
      organization: { id: "org-1", slug: "acme" },
      membership: { id: "membership-1", role: "member" },
    };
    const request = { params: { orgSlug: "acme" }, auth: { user: { id: "user-1" } } };
    const guard = new OrganizationContextGuard(createDatabase([row]) as never);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request).toHaveProperty("organization", row);
  });

  it.each([{ params: { orgSlug: "acme" } }, { params: {}, auth: { user: { id: "user-1" } } }])(
    "rejects a missing organization context",
    async (request) => {
      const guard = new OrganizationContextGuard(createDatabase([]) as never);
      await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    },
  );

  it("hides organizations from users who are not members", async () => {
    const guard = new OrganizationContextGuard(createDatabase([]) as never);
    await expect(
      guard.canActivate(
        createContext({ params: { orgSlug: "acme" }, auth: { user: { id: "user-1" } } }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
