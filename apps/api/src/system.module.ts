import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { DatabaseModule } from "./database/database.module";
import { EmailModule } from "./email/email.module";
import { JobsModule } from "./jobs/jobs.module";
import { StorageModule } from "./storage/storage.module";

@Module({
  imports: [DatabaseModule, StorageModule, EmailModule, JobsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class SystemModule {}
