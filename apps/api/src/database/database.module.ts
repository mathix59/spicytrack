import { Global, Module } from "@nestjs/common";
import {
  DatabaseLifecycleService,
  databasePoolProvider,
  databaseProvider,
  databaseReadReplicaPoolProvider,
} from "./database.provider";

@Global()
@Module({
  providers: [
    databasePoolProvider,
    databaseReadReplicaPoolProvider,
    databaseProvider,
    DatabaseLifecycleService,
  ],
  exports: [databasePoolProvider, databaseReadReplicaPoolProvider, databaseProvider],
})
export class DatabaseModule {}
