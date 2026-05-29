import "reflect-metadata";
import { config as loadEnv } from "dotenv";
import { DataSource } from "typeorm";

loadEnv();

/**
 * Standalone DataSource for the `npm run migration:*` scripts.
 *
 * Migration files are the raw SQL lifted verbatim from the Phase1 repo at
 * `../src/lib/db/migrations/*.sql`. We rewrap them as TypeORM migration
 * classes during the cutover so the migration tracking table works, but
 * the SQL itself is unchanged.
 */
export default new DataSource({
  type: "postgres",
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : false,
  entities: ["src/**/*.entity.ts"],
  migrations: ["src/database/migrations/*.ts"],
  migrationsTableName: "typeorm_migrations",
});
