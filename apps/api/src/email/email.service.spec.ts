import { createTransport } from "nodemailer";
import { EmailService } from "./email.service";

jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));

const config = { host: "smtp.example.test", port: 465, secure: true, user: "user", pass: "secret" };
const message = { to: "invitee@example.test", subject: "Invitation", text: "Join" };

describe("SMTP delivery", () => {
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

  it("sends mail without a separate verification connection", async () => {
    await service.send(message);
    expect(sendMail).toHaveBeenCalledWith({
      from: "noreply@spicytrack.local",
      ...message,
      html: expect.stringContaining("<!doctype html>"),
    });
    expect(verify).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("propagates actual delivery failures and closes the connection", async () => {
    sendMail.mockRejectedValue(new Error("delivery failed"));
    await expect(service.send(message)).rejects.toThrow("delivery failed");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("delivers the dedicated HTML template alongside its plain-text fallback", async () => {
    const invitation = {
      ...message,
      html: '<p><a href="https://example.test/invite?token=abc">Accept invitation</a></p>',
    };
    await service.send(invitation);
    expect(sendMail).toHaveBeenCalledWith({ from: "noreply@spicytrack.local", ...invitation });
  });

  it("handles unconfigured SMTP without opening a connection", async () => {
    smtpConfig.mockResolvedValue(null);
    await service.send(message);
    expect(createTransport).not.toHaveBeenCalled();
  });
});
