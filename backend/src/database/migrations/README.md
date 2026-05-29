# Database migrations

These wrap the **existing** raw SQL files from the Phase1 monorepo
(`../../src/lib/db/migrations/*.sql`) as TypeORM migration classes. We keep
the SQL byte-for-byte identical — only the surrounding `up()` / `down()`
shell changes.

## Why not let TypeORM generate from entities?

The Phase1 schema relies on Postgres features TypeORM's diff engine does not
faithfully reproduce:

- Partial unique indexes (`WHERE deleted_at IS NULL`)
- Multi-column CHECK constraints (`users_role_fk_consistency`)
- BEFORE UPDATE triggers (`set_updated_at`)
- Soft-delete columns and the matching index predicates

Re-deriving these from entity metadata silently drops them. We treat the SQL
as source-of-truth and use TypeORM only for the migrations *runner* (so
`typeorm_migrations` tracks what's been applied to RDS).

## Adding a migration

1. Copy the SQL into a new file `1700000000000-<name>.sql` (epoch-ms prefix
   keeps order predictable).
2. Add a `1700000000000-<name>.ts` class that reads the sibling `.sql` file
   and calls `queryRunner.query()` with it. (Avoid splitting on `;` —
   functions and triggers contain semicolons inside their bodies.)
3. `npm run migration:run` against the RDS instance.

## Down migrations

Most Phase1 SQL files are additive (`CREATE TABLE IF NOT EXISTS`, …). A
naive `down()` that drops the table is unsafe in production. Either:

- Leave `down()` empty and revert via PITR if needed, or
- Write a hand-crafted reverse SQL — but never let TypeORM auto-derive one.
