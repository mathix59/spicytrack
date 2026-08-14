import { Inject, Injectable, Logger, OnApplicationShutdown, Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { withReplicas } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";

export const DATABASE = Symbol("DATABASE");
export const DATABASE_POOL = Symbol("DATABASE_POOL");
export const DATABASE_READ_REPLICA_POOL = Symbol("DATABASE_READ_REPLICA_POOL");
export type DatabaseClient = ReturnType<typeof drizzle<typeof schema>>;
type ReplicaAwareDatabaseClient = DatabaseClient & { $primary?: DatabaseClient };
const databaseLogger = new Logger("DatabasePool");

/** Keep consistency- and authorization-sensitive reads on the writable primary. */
export function primaryDatabase(database: DatabaseClient): DatabaseClient {
  return (database as ReplicaAwareDatabaseClient).$primary ?? database;
}

export function createDatabasePool(connectionString: string, role: string): Pool {
  const pool = new Pool({ connectionString });
  pool.on("error", (error: Error) => {
    databaseLogger.error(`Unexpected error on an idle PostgreSQL ${role} client`, error.stack);
  });
  return pool;
}

export const databasePoolProvider: Provider = {
  provide: DATABASE_POOL,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const connectionString = configService.get<string>("DATABASE_URL");

    if (!connectionString) {
      throw new Error("DATABASE_URL is required");
    }

    return createDatabasePool(connectionString, "primary");
  },
};

export const databaseReadReplicaPoolProvider: Provider = {
  provide: DATABASE_READ_REPLICA_POOL,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const connectionString = configService.get<string>("DATABASE_READ_REPLICA_URL")?.trim();
    return connectionString ? createDatabasePool(connectionString, "read replica") : null;
  },
};

export const databaseProvider: Provider = {
  provide: DATABASE,
  inject: [DATABASE_POOL, DATABASE_READ_REPLICA_POOL],
  useFactory: (primaryPool: Pool, readReplicaPool: Pool | null) => {
    const primary = drizzle(primaryPool, { schema });
    if (!readReplicaPool) return primary;
    return withReplicas(primary, [drizzle(readReplicaPool, { schema })]);
  },
};

@Injectable()
export class DatabaseLifecycleService implements OnApplicationShutdown {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    @Inject(DATABASE_READ_REPLICA_POOL) private readonly readReplicaPool: Pool | null,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.pool.end(), this.readReplicaPool?.end()]);
  }
}
