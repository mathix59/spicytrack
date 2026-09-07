import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { InstanceAdminService } from "./instance-admin.service";

jest.mock("../common/secrets", () => ({
  encryptSecret: (value: string) => `encrypted:${value}`,
  decryptSecret: (value: string) => value.replace("encrypted:", ""),
}));

function database(admin = true) {
  let row: Record<string, unknown> | undefined;
  const upsert = jest.fn(async ({ set }: { set: Record<string, unknown> }) => {
    row = { ...row, ...set };
  });
  const db = {
    select: jest.fn((fields?: unknown) => ({
      from: () => ({
        where: () => ({
          limit: async () => (fields ? [{ isSuperAdmin: admin }] : row ? [row] : []),
        }),
      }),
    })),
    insert: jest.fn(() => ({ values: () => ({ onConflictDoUpdate: upsert }) })),
  };
  return { db, upsert };
}

describe("instance SMTP settings", () => {
  it("creates missing settings, reloads them, and preserves an omitted password", async () => {
    const { db } = database();
    const service = new InstanceAdminService(db as never);
    await service.update("admin", {
      smtpHost: "smtp.test",
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: "sender",
      smtpPass: "secret",
    });
    await service.update("admin", { smtpFrom: "sender@example.test" });
    const reloaded = await new InstanceAdminService(db as never).get();
    expect(reloaded).toMatchObject({
      smtpHost: "smtp.test",
      smtpPort: 465,
      smtpSecure: true,
      smtpPasswordConfigured: true,
    });
    expect(JSON.stringify(reloaded)).not.toContain("secret");
    expect(await service.smtpConfig()).toMatchObject({
      secure: true,
      pass: "secret",
      from: "sender@example.test",
    });
  });
  it("rejects non-admin writes", async () => {
    const { db, upsert } = database(false);
    await expect(new InstanceAdminService(db as never).update("member", {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(upsert).not.toHaveBeenCalled();
  });
  it.each(["string body", { smtpPort: 0 }, { smtpPort: 65536 }, { smtpSecure: "false" }])(
    "rejects malformed settings: %p",
    async (input) => {
      const { db, upsert } = database();
      await expect(
        new InstanceAdminService(db as never).update("admin", input as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(upsert).not.toHaveBeenCalled();
    },
  );
});
