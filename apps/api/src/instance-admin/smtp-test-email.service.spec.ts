import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { SmtpTestEmailService } from "./smtp-test-email.service";

function setup({ admin = true, outcome = "sent" as "sent" | "logged" | Error } = {}) {
  const db = {
    select: jest.fn(() => ({
      from: () => ({ where: () => ({ limit: async () => [{ email: "admin@example.test" }] }) }),
    })),
  };
  const instanceAdmin = {
    assertSuperAdmin: jest.fn(async () => {
      if (!admin) throw new ForbiddenException("Instance administrator access is required.");
    }),
  };
  const email = {
    send: jest.fn(async () => {
      if (outcome instanceof Error) throw outcome;
      return outcome;
    }),
  };
  const service = new SmtpTestEmailService(db as never, instanceAdmin as never, email as never);
  return { service, email };
}

describe("SMTP test email", () => {
  it("sends the test email to the requesting administrator", async () => {
    const { service, email } = setup();
    await expect(service.send("admin")).resolves.toEqual({
      success: true,
      to: "admin@example.test",
    });
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@example.test",
        subject: "SpicyTrack test email",
        html: expect.stringContaining("<!doctype html>"),
      }),
    );
  });

  it("rejects users who are not instance administrators before sending", async () => {
    const { service, email } = setup({ admin: false });
    await expect(service.send("member")).rejects.toBeInstanceOf(ForbiddenException);
    expect(email.send).not.toHaveBeenCalled();
  });

  it("reports missing SMTP settings instead of claiming success", async () => {
    const { service } = setup({ outcome: "logged" });
    await expect(service.send("admin")).rejects.toThrow(
      "Save SMTP settings before sending a test email.",
    );
  });

  it("hides transport details when delivery fails", async () => {
    const { service } = setup({ outcome: new Error("535 auth failed for secret-host") });
    const error = await service.send("admin").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as Error).message).not.toContain("secret-host");
  });
});
