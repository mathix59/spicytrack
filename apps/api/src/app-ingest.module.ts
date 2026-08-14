import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { IngestModule } from "./ingest/ingest.module";
import { SystemModule } from "./system.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    DatabaseModule,
    SystemModule,
    IngestModule,
  ],
})
export class AppIngestModule {}
