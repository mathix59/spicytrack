import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const VERSION = "v1";

let cachedKey: Buffer | null = null;

export function validateProductionSecretConfiguration(
  environment: Record<string, string | undefined> = process.env,
): void {
  if (environment.NODE_ENV !== "production") return;
  const raw = environment.SECRETS_ENCRYPTION_KEY;
  if (!raw || Buffer.from(raw, "base64").length !== KEY_LENGTH) {
    throw new Error("SECRETS_ENCRYPTION_KEY must be set in production and decode to 32 bytes.");
  }
}

function getEncryptionKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const raw = process.env.SECRETS_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32",
    );
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `SECRETS_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${key.length}).`,
    );
  }

  cachedKey = key;
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(":");

  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted secret payload.");
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
