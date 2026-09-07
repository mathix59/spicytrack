import { smtpTransportOptions } from "./smtp-options";

describe("SMTP transport", () => {
  it("uses implicit TLS on port 465 and STARTTLS negotiation on 587", () => {
    expect(smtpTransportOptions({ host: "smtp.test", port: 465 }).secure).toBe(true);
    expect(smtpTransportOptions({ host: "smtp.test", port: 587 }).secure).toBe(false);
  });
  it("honors explicit security settings for nonstandard ports", () => {
    expect(smtpTransportOptions({ host: "smtp.test", port: 2465, secure: true }).secure).toBe(true);
    expect(smtpTransportOptions({ host: "smtp.test", port: 465, secure: false }).secure).toBe(
      false,
    );
  });
  it("omits authentication for unauthenticated relays", () => {
    expect(smtpTransportOptions({ host: "relay", port: 25 })).not.toHaveProperty("auth");
    expect(
      smtpTransportOptions({ host: "relay", port: 587, user: "user", pass: "secret" }).auth,
    ).toEqual({ user: "user", pass: "secret" });
  });
});
