import { UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";

jest.mock("./better-auth", () => ({ getBetterAuthSession: jest.fn() }));
jest.mock("better-auth/node", () => ({ fromNodeHeaders: jest.fn((headers) => headers) }));

function context(token: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }),
    }),
  } as never;
}

function createDatabase(...selectRows: unknown[][]) {
  const updateWhere = jest.fn(async () => undefined);
  return {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({ limit: jest.fn(async () => selectRows.shift() ?? []) })),
      })),
    })),
    update: jest.fn(() => ({ set: jest.fn(() => ({ where: updateWhere })) })),
    updateWhere,
  };
}

describe("AuthGuard personal access tokens", () => {
  it("authenticates an active token, attaches its user, and records usage", async () => {
    const db = createDatabase(
      [{ id: "token-1", userId: "user-1", revokedAt: null, expiresAt: null }],
      [{ id: "user-1", email: "user@example.test" }],
    );
    const guard = new AuthGuard(db as never);
    const request = { headers: { authorization: "Bearer pat_valid" } };
    const executionContext = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(request).toHaveProperty("auth.user.id", "user-1");
    expect(db.updateWhere).toHaveBeenCalled();
  });

  it.each([
    { tokenRows: [] },
    {
      tokenRows: [{ id: "token-1", userId: "user-1", revokedAt: new Date(), expiresAt: null }],
    },
    {
      tokenRows: [
        {
          id: "token-1",
          userId: "user-1",
          revokedAt: null,
          expiresAt: new Date(Date.now() - 1_000),
        },
      ],
    },
  ])("rejects missing, revoked, and expired tokens", async ({ tokenRows }) => {
    const guard = new AuthGuard(createDatabase(tokenRows) as never);
    await expect(guard.canActivate(context("pat_invalid"))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects a token whose user no longer exists", async () => {
    const guard = new AuthGuard(
      createDatabase(
        [{ id: "token-1", userId: "user-1", revokedAt: null, expiresAt: null }],
        [],
      ) as never,
    );
    await expect(guard.canActivate(context("pat_orphan"))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
