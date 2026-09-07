import { createHash } from "node:crypto";
import { betterAuth } from "better-auth";
import { betterAuthPool, handleBetterAuthRequest } from "./better-auth";

jest.mock("better-auth", () => ({
  betterAuth: jest.fn(() => ({
    handler: jest.fn(async () => Response.json({ ok: true })),
    api: {},
  })),
}));
jest.mock("better-auth/plugins", () => ({ genericOAuth: jest.fn(), twoFactor: jest.fn() }));
jest.mock("./oidc-config", () => ({ authenticationConfiguration: {} }));
jest.mock("../database/database.provider", () => ({
  createDatabasePool: () => ({ query: jest.fn() }),
}));

const query = betterAuthPool.query as jest.Mock;
const handler = (betterAuth as jest.Mock).mock.results[0].value.handler as jest.Mock;
function signup(token?: string) {
  return new Request("http://localhost/api/better-auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-invitation-token": token } : {}),
    },
    body: JSON.stringify({
      email: "Invitee@Example.test",
      password: "NewPassword42!",
      name: "Invitee",
    }),
  });
}

describe("invited signup with closed public registration", () => {
  beforeEach(() => {
    query.mockReset();
    handler.mockClear();
  });
  it("hashes the token, normalizes the email and retains the signup body", async () => {
    query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{}] })
      .mockResolvedValueOnce({ rows: [{ registrations_enabled: false }] });
    const request = signup("invitation-secret");
    expect((await handleBetterAuthRequest(request)).status).toBe(200);
    expect(query.mock.calls[0][1]).toEqual([
      createHash("sha256").update("invitation-secret").digest("hex"),
      "invitee@example.test",
    ]);
    expect(await (handler.mock.calls[0][0] as Request).json()).toHaveProperty(
      "password",
      "NewPassword42!",
    );
  });
  it("rejects signup when the database finds no matching invitation", async () => {
    query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    expect((await handleBetterAuthRequest(signup("invalid"))).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
  it("continues to reject public signup without an invitation", async () => {
    query
      .mockResolvedValueOnce({ rows: [{ registrations_enabled: false }] })
      .mockResolvedValueOnce({ rowCount: 1 });
    expect((await handleBetterAuthRequest(signup())).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});
