// Verification helper for migrations 0001 (profiles) and 0002 (sites +
// site_pages). Same shape as verify-b1.mjs — prints public.* tables,
// RLS policies, and rowsecurity flags so we can confirm a fresh
// `pnpm db:migrate` landed the right schema + policies.
//
// Usage from repo root:
//   pnpm --filter @northpoint/db exec dotenv -e ../../apps/web/.env.local \
//     -- node scripts/verify-c1d1.mjs

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });

const EXPECTED_TABLES = ["accounts", "profiles", "site_pages", "sites", "users"];

try {
  const tables = await sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `;
  console.log("\n=== public.* tables ===");
  for (const row of tables) console.log(`  ${row.tablename}`);

  const missing = EXPECTED_TABLES.filter(
    (t) => !tables.find((row) => row.tablename === t),
  );
  if (missing.length > 0) {
    console.log(`\n⚠ missing expected tables: ${missing.join(", ")}`);
  }

  const policies = await sql`
    SELECT schemaname, tablename, policyname, cmd, roles
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `;
  console.log("\n=== RLS policies on public.* ===");
  for (const row of policies) {
    console.log(
      `  ${row.tablename}.${row.policyname} → ${row.cmd} for ${row.roles}`,
    );
  }

  const rls = await sql`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'accounts', 'profiles', 'sites', 'site_pages')
    ORDER BY tablename;
  `;
  console.log("\n=== RLS enabled? ===");
  for (const row of rls) {
    console.log(`  ${row.tablename}: ${row.rowsecurity ? "yes" : "NO"}`);
  }

  // Spot-check FKs — site_pages.site_id → sites, sites.account_id →
  // accounts, profiles.account_id → accounts. Querying pg_constraint
  // confirms ON DELETE behavior.
  const fks = await sql`
    SELECT
      con.conname AS constraint_name,
      cls.relname AS table_name,
      ref.relname AS references_table,
      CASE con.confdeltype WHEN 'c' THEN 'cascade' WHEN 'n' THEN 'set null' WHEN 'r' THEN 'restrict' WHEN 'a' THEN 'no action' ELSE con.confdeltype::text END AS on_delete
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_class ref ON ref.oid = con.confrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    WHERE con.contype = 'f'
      AND ns.nspname = 'public'
    ORDER BY cls.relname, con.conname;
  `;
  console.log("\n=== Foreign keys in public.* ===");
  for (const row of fks) {
    console.log(
      `  ${row.table_name}.${row.constraint_name} → ${row.references_table} (ON DELETE ${row.on_delete})`,
    );
  }
} finally {
  await sql.end();
}
