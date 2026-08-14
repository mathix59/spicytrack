process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/spicytrack";
process.env.STORAGE_ENDPOINT ??= "http://localhost:9002";
process.env.STORAGE_ACCESS_KEY_ID ??= "spicytrack";
process.env.STORAGE_SECRET_ACCESS_KEY ??= "spicytrack-secret";
