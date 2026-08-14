import { FactoryProvider, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { integer, pgTable } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import {
  DatabaseClient,
  createDatabasePool,
  databasePoolProvider,
  databaseProvider,
  databaseReadReplicaPoolProvider,
  primaryDatabase,
} from "./database.provider";

const routingProbe = pgTable("routing_probe", { id: integer("id") });

describe("databasePoolProvider", () => {
  it("handles idle client errors from dedicated pools", async () => {
    const logger = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const pool = createDatabasePool(
      "postgresql://spicytrack:spicytrack@localhost/spicytrack",
      "Better Auth",
    );
    const error = new Error("connection terminated");

    expect(() => pool.emit("error", error)).not.toThrow();
    expect(logger).toHaveBeenCalledWith(
      "Unexpected error on an idle PostgreSQL Better Auth client",
      error.stack,
    );

    await pool.end();
    logger.mockRestore();
  });

  it("handles idle PostgreSQL client errors without crashing the process", async () => {
    const logger = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const factory = (databasePoolProvider as FactoryProvider<Pool>).useFactory as (
      configService: ConfigService,
    ) => Pool;
    const pool = factory({
      get: jest.fn().mockReturnValue("postgresql://spicytrack:spicytrack@localhost/spicytrack"),
    } as unknown as ConfigService);
    const error = new Error("connection terminated");

    expect(() => pool.emit("error", error)).not.toThrow();
    expect(logger).toHaveBeenCalledWith(
      "Unexpected error on an idle PostgreSQL primary client",
      error.stack,
    );

    await pool.end();
    logger.mockRestore();
  });

  it("does not create a read replica pool when its URL is empty", () => {
    const factory = (databaseReadReplicaPoolProvider as FactoryProvider<Pool | null>)
      .useFactory as (configService: ConfigService) => Pool | null;

    expect(
      factory({ get: jest.fn().mockReturnValue("  ") } as unknown as ConfigService),
    ).toBeNull();
  });

  it("routes selects to the replica and mutations to the primary", async () => {
    const primary = new Pool();
    const replica = new Pool();
    const primaryQuery = jest
      .spyOn(primary, "query")
      .mockResolvedValue({ rows: [], rowCount: 1 } as never);
    const replicaQuery = jest
      .spyOn(replica, "query")
      .mockResolvedValue({ rows: [{ value: 1 }], rowCount: 1 } as never);
    const factory = (databaseProvider as FactoryProvider).useFactory as (
      primaryPool: Pool,
      readReplicaPool: Pool | null,
    ) => DatabaseClient;
    const db = factory(primary, replica);

    await db.select().from(routingProbe).execute();
    await db.insert(routingProbe).values({ id: 1 }).execute();

    expect(replicaQuery).toHaveBeenCalledTimes(1);
    expect(primaryQuery).toHaveBeenCalledTimes(1);
    await Promise.all([primary.end(), replica.end()]);
  });

  it("can force consistency-sensitive selects onto the primary", async () => {
    const primary = new Pool();
    const replica = new Pool();
    const primaryQuery = jest
      .spyOn(primary, "query")
      .mockResolvedValue({ rows: [{ value: 1 }], rowCount: 1 } as never);
    const replicaQuery = jest
      .spyOn(replica, "query")
      .mockResolvedValue({ rows: [], rowCount: 0 } as never);
    const factory = (databaseProvider as FactoryProvider).useFactory as (
      primaryPool: Pool,
      readReplicaPool: Pool | null,
    ) => DatabaseClient;
    const db = factory(primary, replica);

    await primaryDatabase(db).select().from(routingProbe).execute();

    expect(primaryQuery).toHaveBeenCalledTimes(1);
    expect(replicaQuery).not.toHaveBeenCalled();
    await Promise.all([primary.end(), replica.end()]);
  });
});
