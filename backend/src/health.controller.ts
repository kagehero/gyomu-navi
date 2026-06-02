import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

@Controller("health")
export class HealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Liveness probe — answers "is the process up?" without touching the DB.
   * Cheap to call; safe for ALB / Nginx upstream checks.
   */
  @Get()
  health() {
    return { ok: true, ts: new Date().toISOString() };
  }

  /**
   * Readiness probe — actually pings Postgres. Returns 200 on success and
   * 503 on failure so orchestrators / curl can distinguish "process up but DB
   * unreachable" from "process down".
   *
   * Don't wire this to ALB's *main* health check on a single-replica deploy
   * (it'll cycle the instance on transient Postgres blips). Use `/api/health`
   * for liveness and `/api/health/db` for explicit DB diagnostics.
   */
  @Get("db")
  async db() {
    const start = Date.now();
    try {
      const rows = await this.ds.query(
        'SELECT current_database() AS db, current_user AS "user", 1 AS ok',
      );
      return {
        ok: true,
        latencyMs: Date.now() - start,
        db: rows[0]?.db,
        user: rows[0]?.user,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Log full detail for the operator, return a short reason to the caller.
      // eslint-disable-next-line no-console
      console.error("[health.db] DB ping failed:", msg);
      throw new ServiceUnavailableException({
        ok: false,
        latencyMs: Date.now() - start,
        error: msg,
      });
    }
  }
}
