// One-off verification helper for the B1 migration.
// Lists public.* tables and RLS policies. Not part of the build.
// Usage from repo root:
//   pnpm dlx dotenv-cli -e apps/web/.env.local -- node packages/db/scripts/verify-b1.mjs

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });

try {
  const tables = await sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `;
  console.log("\n=== public.* tables ===");
  for (const row of tables) console.log(`  ${row.tablename}`);

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
    WHERE schemaname = 'public' AND tablename IN ('users', 'accounts')
    ORDER BY tablename;
  `;
  console.log("\n=== RLS enabled? ===");
  for (const row of rls) {
    console.log(`  ${row.tablename}: ${row.rowsecurity ? "yes" : "NO"}`);
  }
} finally {
  await sql.end();
}
