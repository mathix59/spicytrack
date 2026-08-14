import { BadRequestException } from "@nestjs/common";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new BadRequestException(`${field} must be a string`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new BadRequestException(`${field} is required`);
  }

  return trimmed;
}

export function assertEmail(value: unknown): string {
  const email = assertString(value, "email").toLowerCase();

  if (!email.includes("@")) {
    throw new BadRequestException("email is invalid");
  }

  return email;
}

export function assertPassword(value: unknown): string {
  const password = assertString(value, "password");

  if (password.length < 8) {
    throw new BadRequestException("password must be at least 8 characters");
  }

  return password;
}

export function assertSlug(value: unknown, field = "slug", maxLength?: number): string {
  const slug = assertString(value, field).toLowerCase();

  if (!SLUG_REGEX.test(slug)) {
    throw new BadRequestException(
      `${field} must contain lowercase letters, numbers, and hyphens only`,
    );
  }
  if (maxLength !== undefined && slug.length > maxLength) {
    throw new BadRequestException(`${field} must contain at most ${maxLength} characters`);
  }

  return slug;
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return assertString(value, "value");
}

export function optionalNullableString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return assertString(value, "value");
}

export function assertOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  const stringValue = assertString(value, field);

  if (!allowed.includes(stringValue as T)) {
    throw new BadRequestException(`${field} must be one of: ${allowed.join(", ")}`);
  }

  return stringValue as T;
}

export function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new BadRequestException(`${field} must be a number`);
  }

  return value;
}

export function assertBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new BadRequestException(`${field} must be a boolean`);
  }

  return value;
}
