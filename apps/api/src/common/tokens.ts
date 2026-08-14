import { createHash, randomBytes } from "node:crypto";

export function generateOpaqueToken(prefix?: string): {
  token: string;
  hash: string;
} {
  const random = randomBytes(32).toString("hex");
  const token = prefix ? `${prefix}_${random}` : random;
  const hash = createHash("sha256").update(token).digest("hex");

  return { token, hash };
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
