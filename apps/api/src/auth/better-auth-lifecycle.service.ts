import { Injectable, OnApplicationShutdown } from "@nestjs/common";
import { betterAuthPool } from "./better-auth";

@Injectable()
export class BetterAuthLifecycleService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await betterAuthPool.end();
  }
}
