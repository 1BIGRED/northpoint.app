// Idempotent seed script for the spike editor.
// Ensures the given email has an auth.users row, a public.users row,
// a public.accounts row (type='client'), and one public.sites row +
// public.site_pages row at path '/'. Safe to re-run.
//
// Uses the Supabase service role (bypasses RLS) — this is a one-off
// developer-side seed step, NOT a request-path code path.
//
// Usage (from repo root):
//   pnpm db:seed-debug-site --email someone@example.com
//
// Required env (loaded from apps/web/.env.local):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   DATABASE_URL  (used by postgres-js for the public.* writes)

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) {
      out.email = args[i + 1];
      i++;
    } else if (args[i] === "--site-name" && args[i + 1]) {
      out.siteName = args[i + 1];
      i++;
    }
  }
  return out;
}

const { email, siteName = "Debug site" } = parseArgs();
if (!email) {
  console.error("usage: pnpm db:seed-debug-site --email someone@example.com [--site-name 'name']");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
if (!supabaseUrl || !serviceRoleKey || !databaseUrl) {
  console.error("missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DATABASE_URL");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = postgres(databaseUrl, { max: 1, prepare: false });

async function ensureAuthUser() {
  // Look up first via admin.listUsers; create if missing.
  const { data: list, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw new Error(`listUsers: ${listError.message}`);
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    console.log(`auth.users: existing → ${existing.id}`);
    return existing.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  console.log(`auth.users: created → ${data.user.id}`);
  return data.user.id;
}

async function ensurePublicUser(authUserId) {
  // public.users.id == auth.users.id (1:1 per B1 schema).
  const rows = await sql`
    INSERT INTO public.users (id, email, role)
    VALUES (${authUserId}, ${email}, 'user')
    ON CONFLICT (id) DO NOTHING
    RETURNING id;
  `;
  console.log(
    rows.length > 0
      ? `public.users: inserted ${authUserId}`
      : `public.users: already present ${authUserId}`,
  );
}

async function ensureAccount(authUserId) {
  // Reuse the first client-type account for this user if one exists.
  const existing = await sql`
    SELECT id FROM public.accounts
    WHERE user_id = ${authUserId} AND type = 'client' AND deleted_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1;
  `;
  if (existing.length > 0) {
    console.log(`public.accounts: existing → ${existing[0].id}`);
    return existing[0].id;
  }
  const rows = await sql`
    INSERT INTO public.accounts (user_id, type)
    VALUES (${authUserId}, 'client')
    RETURNING id;
  `;
  console.log(`public.accounts: created → ${rows[0].id}`);
  return rows[0].id;
}

async function ensureSite(accountId) {
  const existing = await sql`
    SELECT id FROM public.sites
    WHERE account_id = ${accountId} AND name = ${siteName} AND deleted_at IS NULL
    LIMIT 1;
  `;
  if (existing.length > 0) {
    console.log(`public.sites: existing → ${existing[0].id}`);
    return existing[0].id;
  }
  const rows = await sql`
    INSERT INTO public.sites (account_id, name, status)
    VALUES (${accountId}, ${siteName}, 'draft')
    RETURNING id;
  `;
  console.log(`public.sites: created → ${rows[0].id}`);
  return rows[0].id;
}

async function ensureRootPage(siteId) {
  const existing = await sql`
    SELECT id FROM public.site_pages
    WHERE site_id = ${siteId} AND path = '/' AND deleted_at IS NULL
    LIMIT 1;
  `;
  if (existing.length > 0) {
    console.log(`public.site_pages: existing root page → ${existing[0].id}`);
    return existing[0].id;
  }
  const rows = await sql`
    INSERT INTO public.site_pages (site_id, path)
    VALUES (${siteId}, '/')
    RETURNING id;
  `;
  console.log(`public.site_pages: created root page → ${rows[0].id}`);
  return rows[0].id;
}

try {
  const authUserId = await ensureAuthUser();
  await ensurePublicUser(authUserId);
  const accountId = await ensureAccount(authUserId);
  const siteId = await ensureSite(accountId);
  await ensureRootPage(siteId);

  console.log("\nDone. To open the spike editor against this site:");
  console.log(`  http://localhost:3000/spike/editor?siteId=${siteId}`);
} finally {
  await sql.end();
}
