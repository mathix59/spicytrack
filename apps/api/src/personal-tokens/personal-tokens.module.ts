import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PersonalTokensController } from "./personal-tokens.controller";
import { PersonalTokensService } from "./personal-tokens.service";

@Module({
  imports: [AuthModule],
  controllers: [PersonalTokensController],
  providers: [PersonalTokensService],
  exports: [PersonalTokensService],
})
export class PersonalTokensModule {}
