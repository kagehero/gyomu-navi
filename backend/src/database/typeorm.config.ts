import { ConfigService } from "@nestjs/config";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { join } from "node:path";

/**
 * NestJS runtime DataSource factory.
 *
 * Important: `synchronize` is **false**. Schema lives in raw SQL migrations
 * lifted from `../src/lib/db/migrations/*.sql` of the Phase1 monorepo —
 * partial unique indexes, CHECK constraints, triggers, and the role/FK
 * consistency CHECK are not faithfully reproduced by `synchronize`.
 *
 * The runtime never runs migrations either; that's a manual `npm run
 * migration:run` step gated on deploy approval.
 */
export const typeOrmConfig = (cs: ConfigService): TypeOrmModuleOptions => ({
  type: "postgres",
  host: cs.get<string>("DATABASE_HOST"),
  port: Number(cs.get<string>("DATABASE_PORT") ?? 5432),
  username: cs.get<string>("DATABASE_USERNAME"),
  password: cs.get<string>("DATABASE_PASSWORD"),
  database: cs.get<string>("DATABASE_NAME"),
  ssl:
    cs.get<string>("DATABASE_SSL") === "true"
      ? { rejectUnauthorized: false }
      : false,
  autoLoadEntities: true,
  synchronize: false,
  migrationsRun: false,
  logging: cs.get<string>("LOG_LEVEL") === "debug" ? "all" : ["error", "warn"],
  entities: [join(__dirname, "..", "**", "*.entity.{ts,js}")],
});
