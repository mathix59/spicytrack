import { Pool } from "pg";

const [command, email] = process.argv.slice(2);
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/spicytrack";

const pool = new Pool({ connectionString });

try {
  if (command === "reset") {
    const result = await pool.query(
      "UPDATE users SET is_super_admin = false WHERE is_super_admin = true",
    );
    console.log(`Removed super-admin access from ${result.rowCount} user(s).`);
  } else if (command === "grant" && email) {
    const result = await pool.query(
      "UPDATE users SET is_super_admin = true, updated_at = NOW() WHERE LOWER(email) = LOWER($1) RETURNING email",
      [email],
    );
    if (!result.rowCount) throw new Error(`No user exists with email: ${email}`);
    console.log(`Granted super-admin access to ${result.rows[0].email}.`);
  } else {
    throw new Error("Usage: manage-super-admin.mjs reset | grant <email>");
  }
} finally {
  await pool.end();
}
