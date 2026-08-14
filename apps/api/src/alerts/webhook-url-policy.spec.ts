import { BadRequestException } from "@nestjs/common";
import { assertSafeWebhookUrl, isPrivateAddress, parseWebhookUrl } from "./webhook-url-policy";

describe("webhook URL policy", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("recognizes private address %s", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each([
    "http://localhost/hook",
    "http://metadata.internal/latest",
    "http://169.254.169.254/latest/meta-data",
    "file:///etc/passwd",
    "https://user:secret@example.com/hook",
  ])("rejects hostile destination %s", (target) => {
    expect(() => parseWebhookUrl(target)).toThrow(BadRequestException);
  });

  it("accepts a structurally public HTTPS destination", () => {
    expect(parseWebhookUrl("https://hooks.example.com/path").toString()).toBe(
      "https://hooks.example.com/path",
    );
  });

  it("rejects a hostname when DNS resolves it to a private address", async () => {
    await expect(assertSafeWebhookUrl("http://localhost.test/hook")).rejects.toThrow(
      BadRequestException,
    );
  });
});
