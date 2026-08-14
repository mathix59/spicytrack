import { Controller, Get, Header, ServiceUnavailableException } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AppService } from "./app.service";
import { EndpointAccess } from "./auth/endpoint-access.decorator";
import { HealthDto } from "./openapi/contracts";

@ApiTags("system")
@EndpointAccess("public")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get("health")
  @ApiOperation({ operationId: "getHealth" })
  @ApiOkResponse({ type: HealthDto })
  async getHealth() {
    return this.readiness();
  }

  @Get("health/live")
  @ApiOperation({ operationId: "getLiveness" })
  @ApiOkResponse({ type: HealthDto })
  liveness() {
    return this.appService.getLiveness();
  }

  @Get("health/ready")
  @ApiOperation({ operationId: "getReadiness" })
  @ApiOkResponse({ type: HealthDto })
  async readiness() {
    const health = await this.appService.getReadiness();
    if (health.status !== "ok") throw new ServiceUnavailableException(health);
    return health;
  }

  @Get("metrics")
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  @ApiOperation({ operationId: "getMetrics" })
  @ApiOkResponse({ schema: { type: "string" } })
  metrics() {
    return this.appService.getMetrics();
  }
}
