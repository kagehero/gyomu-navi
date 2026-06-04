import "reflect-metadata";
import * as bcrypt from "bcrypt";
import dataSource from "../../ormconfig";

/**
 * Idempotent admin seed.
 *
 * Creates (or repairs) a single admin user using the **backend's own** DB
 * connection (ormconfig / backend `.env`). This guarantees the seeded user
 * lands in exactly the database that login auth (`AuthService.validate`)
 * reads from — avoiding the "seeded one DB, log in against another" trap.
 *
 * Login matches email case-insensitively (`email.toLowerCase()`), so the
 * email here is stored lowercase. `login_approved_at` is irrelevant for
 * admins — `findByEmail` does not gate on it.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=changeme123 npm run seed:admin
 * Both vars are optional; defaults below are applied when unset.
 */
const SALT_ROUNDS = 10;
const email = (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "changeme123";
const displayName = process.env.ADMIN_NAME ?? "管理者";

async function seedAdmin(): Promise<void> {
  await dataSource.initialize();
  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Upsert on the unique email. On conflict we force app_role back to
    // 'admin', refresh the password, and clear any soft-delete so a stale
    // or downgraded row is repaired in place.
    const rows: Array<{ id: string; email: string; app_role: string }> =
      await dataSource.query(
        `INSERT INTO users (email, password_hash, display_name, app_role)
         VALUES ($1, $2, $3, 'admin')
         ON CONFLICT (email) DO UPDATE
           SET password_hash = EXCLUDED.password_hash,
               display_name  = EXCLUDED.display_name,
               app_role      = 'admin',
               deleted_at    = NULL
         RETURNING id, email, app_role`,
        [email, passwordHash, displayName],
      );

    const row = rows[0];
    console.log("Admin seed complete.");
    console.log(`  id       : ${row.id}`);
    console.log(`  email    : ${row.email}`);
    console.log(`  app_role : ${row.app_role}`);
    console.log(`  password : ${password}`);
    console.log("Log out and back in so the JWT carries role=admin.");
  } finally {
    await dataSource.destroy();
  }
}

seedAdmin().catch((err) => {
  console.error("Admin seed failed:", err);
  process.exit(1);
});
