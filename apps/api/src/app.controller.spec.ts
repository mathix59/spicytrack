import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getHello: () => "SpicyTrack API",
            getLiveness: () => ({ status: "ok", service: "api" }),
            getReadiness: async () => ({ status: "ok", service: "api" }),
            getMetrics: async () => "spicytrack_process_uptime_seconds 1\n",
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe("root", () => {
    it("should return the API banner", () => {
      expect(appController.getHello()).toBe("SpicyTrack API");
    });

    it("should expose a health payload", async () => {
      await expect(appController.getHealth()).resolves.toMatchObject({
        status: "ok",
        service: "api",
      });
    });

    it("should expose Prometheus metrics", async () => {
      await expect(appController.metrics()).resolves.toContain("spicytrack_process_uptime_seconds");
    });
  });
});
