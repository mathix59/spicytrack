import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, validateProductionSecretConfiguration } from "./secrets";

describe("secrets", () => {
  beforeAll(() => {
    process.env.SECRETS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  });

  it("round-trips a secret", () => {
    const ciphertext = encryptSecret("ghp_super-secret-token");
    expect(ciphertext).toMatch(/^v1:/);
    expect(ciphertext).not.toContain("ghp_super-secret-token");
    expect(decryptSecret(ciphertext)).toBe("ghp_super-secret-token");
  });

  it("produces a different ciphertext per call (random IV)", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("rejects tampered payloads", () => {
    const ciphertext = encryptSecret("secret");
    const [version, iv, tag, data] = ciphertext.split(":");
    const tamperedData = Buffer.from(data, "base64");
    tamperedData[0] ^= 1;
    const tampered = [version, iv, tag, tamperedData.toString("base64")].join(":");
    expect(() => decryptSecret(tampered)).toThrow(
      "Unsupported state or unable to authenticate data",
    );
  });

  it("rejects malformed payloads", () => {
    expect(() => decryptSecret("not-encrypted")).toThrow("Invalid encrypted secret payload.");
  });
});

describe("validateProductionSecretConfiguration", () => {
  it("allows development without an encryption key", () => {
    expect(() => validateProductionSecretConfiguration({ NODE_ENV: "development" })).not.toThrow();
  });

  it("rejects a missing or malformed production encryption key", () => {
    expect(() => validateProductionSecretConfiguration({ NODE_ENV: "production" })).toThrow(
      "SECRETS_ENCRYPTION_KEY",
    );
    expect(() =>
      validateProductionSecretConfiguration({
        NODE_ENV: "production",
        SECRETS_ENCRYPTION_KEY: Buffer.from("too short").toString("base64"),
      }),
    ).toThrow("SECRETS_ENCRYPTION_KEY");
  });

  it("accepts a 32-byte production encryption key", () => {
    expect(() =>
      validateProductionSecretConfiguration({
        NODE_ENV: "production",
        SECRETS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      }),
    ).not.toThrow();
  });
});
