import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  // Liveness only — used by ALB / Nginx upstream check.
  // Readiness (DB ping) belongs to a separate endpoint if/when needed.
  @Get()
  health() {
    return { ok: true, ts: new Date().toISOString() };
  }
}
