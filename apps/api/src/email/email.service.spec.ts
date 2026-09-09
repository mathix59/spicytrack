import { createTransport } from "nodemailer";
import { EmailService } from "./email.service";

jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));

const config = { host: "smtp.example.test", port: 465, secure: true, user: "user", pass: "secret" };
const message = { to: "invitee@example.test", subject: "Invitation", text: "Join" };

describe("SMTP health diagnostics", () => {
  const verify = jest.fn();
  const sendMail = jest.fn();
  const close = jest.fn();
  const smtpConfig = jest.fn();
  let service: EmailService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();
    smtpConfig.mockResolvedValue(config);
    sendMail.mockResolvedValue({});
    (createTransport as jest.Mock).mockReturnValue({ verify, sendMail, close });
    service = new EmailService({ smtpConfig } as never);
  });
  afterEach(() => jest.useRealTimers());

  it("does not block readiness on a slow TLS handshake and shares the probe", async () => {
    let finish!: () => void;
    verify.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    expect(await service.checkHealth()).toBe("checking");
    await jest.advanceTimersByTimeAsync(4_000);
    expect(await service.checkHealth()).toBe("checking");
    expect(verify).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ secure: true, port: 465 }),
    );
    finish();
    await jest.advanceTimersByTimeAsync(0);
    expect(await service.checkHealth()).toBe("ok");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes timed-out probes and retries after the cache expires", async () => {
    verify.mockReturnValue(new Promise(() => {}));
    await service.checkHealth();
    await jest.advanceTimersByTimeAsync(20_000);
    expect(await service.checkHealth()).toBe("error");
    expect(close).toHaveBeenCalledTimes(1);
    verify.mockResolvedValue(true);
    await jest.advanceTimersByTimeAsync(60_000);
    await service.checkHealth();
    await jest.advanceTimersByTimeAsync(0);
    expect(await service.checkHealth()).toBe("ok");
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it("keeps successful delivery healthy even when an older probe fails", async () => {
    let rejectProbe!: (error: Error) => void;
    verify.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectProbe = reject;
        }),
    );
    await service.checkHealth();
    await service.send(message);
    rejectProbe(new Error("verification rejected"));
    await jest.advanceTimersByTimeAsync(0);
    expect(await service.checkHealth()).toBe("ok");
    expect(verify).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(2);
  });

  it("invalidates cached success when SMTP credentials change", async () => {
    await service.send(message);
    smtpConfig.mockResolvedValue({ ...config, pass: "changed" });
    verify.mockRejectedValue(new Error("authentication failed"));
    await service.checkHealth();
    await jest.advanceTimersByTimeAsync(0);
    expect(await service.checkHealth()).toBe("error");
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("propagates actual delivery failures and closes the connection", async () => {
    sendMail.mockRejectedValue(new Error("delivery failed"));
    await expect(service.send(message)).rejects.toThrow("delivery failed");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("reports disabled SMTP without opening a connection", async () => {
    smtpConfig.mockResolvedValue(null);
    expect(await service.checkHealth()).toBe("disabled");
    expect(createTransport).not.toHaveBeenCalled();
  });
});
