import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../src/database/schema";

/**
 * A throwaway database for tests that drop rows or tables the shared test data relies on.
 * A separate database rather than a schema: Better Auth introspects every schema of its
 * database, and a schema dropped mid-introspection fails requests in other suites.
 */
export function privateDatabase(prefix: string) {
  const name = `${prefix}_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(process.env.DATABASE_URL ?? "");
  const admin = new Pool({ connectionString: url.toString() });
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString() });
  const db = drizzle(pool, { schema });

  return {
    db,
    async create() {
      await admin.query(`CREATE DATABASE "${name}"`);
      await migrate(db, { migrationsFolder: resolve(__dirname, "../drizzle") });
    },
    async drop() {
      await pool.end();
      // `end` resolves before the closing sockets are gone, and FORCE would make them fail.
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const { rows } = await admin.query<{ count: number }>(
          "select count(*)::int as count from pg_stat_activity where datname = $1",
          [name],
        );
        if (rows[0].count === 0) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.end();
    },
  };
}
