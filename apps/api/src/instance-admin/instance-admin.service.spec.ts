import { createTransport } from "nodemailer";
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

jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));

describe("manual SMTP connection test", () => {
  const verify = jest.fn();
  const close = jest.fn();
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    (createTransport as jest.Mock).mockReturnValue({ verify, close });
    verify.mockResolvedValue(true);
  });
  afterEach(() => jest.useRealTimers());

  it("tests unsaved values with the stored password without writing settings", async () => {
    const { db, upsert } = database();
    const service = new InstanceAdminService(db as never);
    await service.update("admin", { smtpHost: "smtp.test", smtpPort: 465, smtpPass: "secret" });
    upsert.mockClear();
    await expect(
      service.testSmtp("admin", {
        smtpHost: "SMTP.test",
        smtpPort: 465,
        smtpSecure: true,
        smtpUser: "sender",
      }),
    ).resolves.toEqual({ success: true });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "SMTP.test",
        port: 465,
        secure: true,
        auth: { user: "sender", pass: "secret" },
      }),
    );
    expect(upsert).not.toHaveBeenCalled();
    expect(await service.get()).toMatchObject({ smtpHost: "smtp.test" });
    expect(verify).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it.each([
    { smtpHost: "attacker.test", smtpPort: 465 },
    { smtpHost: "smtp.test", smtpPort: 2525 },
  ])("never sends the stored password to another server: %p", async (target) => {
    const { db } = database();
    const service = new InstanceAdminService(db as never);
    await service.update("admin", { smtpHost: "smtp.test", smtpPort: 465, smtpPass: "secret" });
    await expect(service.testSmtp("admin", { ...target, smtpUser: "sender" })).rejects.toThrow(
      "Enter the SMTP password",
    );
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("uses newly entered credentials and sanitizes provider errors", async () => {
    verify.mockRejectedValue(new Error("provider exposed secret"));
    const { db } = database();
    await expect(
      new InstanceAdminService(db as never).testSmtp("admin", {
        smtpHost: "smtp.test",
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: "sender",
        smtpPass: "new-secret",
      }),
    ).rejects.toThrow("SMTP connection failed.");
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ secure: false, auth: { user: "sender", pass: "new-secret" } }),
    );
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes a stalled verification after 20 seconds without retries", async () => {
    verify.mockReturnValue(new Promise(() => {}));
    const { db } = database();
    const result = new InstanceAdminService(db as never)
      .testSmtp("admin", { smtpHost: "smtp.test" })
      .catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(20_000);
    expect(await result).toMatchObject({
      message: expect.stringContaining("SMTP connection failed.") as unknown,
    });
    await jest.advanceTimersByTimeAsync(60_000);
    expect(close).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("rejects non-admin tests before opening a connection", async () => {
    const { db } = database(false);
    await expect(
      new InstanceAdminService(db as never).testSmtp("member", { smtpHost: "smtp.test" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { smtpHost: " " },
    { smtpHost: "smtp.test", smtpPort: -1 },
    { smtpHost: "smtp.test", smtpSecure: "true" },
  ])("rejects invalid test configuration: %p", async (input) => {
    const { db } = database();
    await expect(
      new InstanceAdminService(db as never).testSmtp("admin", input as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createTransport).not.toHaveBeenCalled();
  });
});
