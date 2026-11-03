import { NotFoundException } from "@nestjs/common";
import { AppController } from "./app.controller";
import type { AppService } from "./app.service";

describe("AppController metrics", () => {
  const appService = { getMetrics: jest.fn(() => "spicytrack_up 1\n") };
  const controller = new AppController(appService as unknown as AppService);

  afterEach(() => {
    delete process.env.METRICS_TOKEN;
  });

  it("serves metrics without a token when METRICS_TOKEN is unset", () => {
    expect(controller.metrics()).toBe("spicytrack_up 1\n");
  });

  it("requires the bearer token when METRICS_TOKEN is set", () => {
    process.env.METRICS_TOKEN = "scrape-secret";

    expect(() => controller.metrics()).toThrow(NotFoundException);
    expect(() => controller.metrics("Bearer wrong")).toThrow(NotFoundException);
    expect(controller.metrics("Bearer scrape-secret")).toBe("spicytrack_up 1\n");
  });
});
