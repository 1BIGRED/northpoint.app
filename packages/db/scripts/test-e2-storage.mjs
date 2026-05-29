// Integration test for the E2 editor persistence layer.
//
// Exercises the load -> save -> load -> publish -> load round-trip against
// the live Supabase database, plus a cross-user RLS denial check.
//
// IMPORTANT: production code (apps/web/lib/editor/storage/supabase.ts) runs
// every query through the cookie-bound *user-session* client — RLS does the
// access control, never the service role. Next.js Server Actions need request
// context (cookies) and can't be invoked from a standalone Node script, so
// this test reproduces the exact same query shapes through a real user session
// (admin-created user -> signInWithPassword -> bearer-token client). Setup and
// teardown use the service role; the round-trip under test does not.
//
// Usage (from repo root):
//   pnpm db:test-e2-storage
//
// Required env (loaded from apps/web/.env.local):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY

import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRoleKey) {
  console.error(
    "missing env: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- assertions -----------------------------------------------------------

let passed = 0;
function check(label, condition) {
  if (!condition) throw new Error(`FAIL: ${label}`);
  passed++;
  console.log(`  ok  ${label}`);
}

const PATH = "/";

// Postgres `jsonb` does not preserve object key order — it normalizes keys on
// storage (e.g. `{version, blocks}` round-trips as `{blocks, version}`). A
// plain JSON.stringify comparison is therefore order-sensitive in a way the
// data is not, so compare with a canonical (recursively key-sorted) encoding.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
function docEquals(a, b) {
  return canonical(a) === canonical(b);
}

// ---- query shapes mirrored from lib/editor/storage/supabase.ts ------------

function isEditorDocument(value) {
  if (typeof value !== "object" || value === null) return false;
  return value.version === 1 && Array.isArray(value.blocks);
}

async function loadDocument(client, siteId, path) {
  const { data, error } = await client
    .from("site_pages")
    .select("draft_content, content, published_at")
    .eq("site_id", siteId)
    .eq("path", path)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`loadDocument failed: ${error.message}`);
  if (!data) {
    return { document: { version: 1, blocks: [] }, publishedAt: null, isNew: true };
  }
  const candidate = data.draft_content ?? data.content;
  const document = isEditorDocument(candidate) ? candidate : { version: 1, blocks: [] };
  return { document, publishedAt: data.published_at ?? null, isNew: false };
}

async function saveDocument(client, siteId, path, document) {
  const { error } = await client.from("site_pages").upsert(
    {
      site_id: siteId,
      path,
      draft_content: document,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "site_id,path" },
  );
  if (error) throw new Error(`saveDocument failed: ${error.message}`);
}

async function publishDocument(client, siteId, path) {
  const { data, error: readError } = await client
    .from("site_pages")
    .select("draft_content")
    .eq("site_id", siteId)
    .eq("path", path)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError) throw new Error(`publishDocument read failed: ${readError.message}`);
  if (!data?.draft_content) throw new Error("publishDocument: no draft to publish");

  const now = new Date().toISOString();
  const { error: updateError } = await client
    .from("site_pages")
    .update({ content: data.draft_content, published_at: now, updated_at: now })
    .eq("site_id", siteId)
    .eq("path", path)
    .is("deleted_at", null);
  if (updateError) throw new Error(`publishDocument update failed: ${updateError.message}`);
}

// ---- setup / teardown (service role) --------------------------------------

async function createUser(email) {
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  const id = data.user.id;

  const { error: pubErr } = await admin
    .from("users")
    .insert({ id, email, role: "user" });
  if (pubErr) throw new Error(`public.users insert: ${pubErr.message}`);

  const { data: acct, error: acctErr } = await admin
    .from("accounts")
    .insert({ user_id: id, type: "client" })
    .select("id")
    .single();
  if (acctErr) throw new Error(`accounts insert: ${acctErr.message}`);

  return { id, email, password, accountId: acct.id };
}

async function createSite(accountId, name) {
  const { data, error } = await admin
    .from("sites")
    .insert({ account_id: accountId, name, status: "draft" })
    .select("id")
    .single();
  if (error) throw new Error(`sites insert: ${error.message}`);
  return data.id;
}

async function userClientFor(user) {
  const auth = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await auth.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw new Error(`signIn(${user.email}): ${error.message}`);
  const token = data.session?.access_token;
  if (!token) throw new Error(`signIn(${user.email}): no access_token`);
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function cleanup(userIds) {
  for (const id of userIds) {
    if (!id) continue;
    // CASCADE on the FKs unwinds accounts -> sites -> site_pages, but be
    // explicit so a missing cascade can't leave orphaned test rows.
    await admin.from("accounts").delete().eq("user_id", id);
    await admin.from("users").delete().eq("id", id);
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }
}

// ---- run ------------------------------------------------------------------

const stamp = Date.now();
const userA = { email: `e2e-storage-${stamp}-a@northpoint.test` };
const userB = { email: `e2e-storage-${stamp}-b@northpoint.test` };

const docV1 = {
  version: 1,
  blocks: [{ id: "blk-1", type: "text", props: { text: "first draft" } }],
};
const docV2 = {
  version: 1,
  blocks: [{ id: "blk-1", type: "text", props: { text: "edited draft" } }],
};

let aId;
let bId;
try {
  console.log("setup: creating users + site");
  const a = await createUser(userA.email);
  aId = a.id;
  Object.assign(userA, a);
  const siteId = await createSite(a.accountId, "E2 test site");

  const b = await createUser(userB.email);
  bId = b.id;
  Object.assign(userB, b);

  const aClient = await userClientFor(userA);
  const bClient = await userClientFor(userB);

  console.log("\nround-trip (owner = user A):");
  const initial = await loadDocument(aClient, siteId, PATH);
  check("initial load reports new/empty page", initial.isNew === true && initial.document.blocks.length === 0);

  await saveDocument(aClient, siteId, PATH, docV1);
  const afterSave = await loadDocument(aClient, siteId, PATH);
  check("load after save returns the saved draft", docEquals(afterSave.document, docV1));
  check("draft is not yet published", afterSave.publishedAt === null);

  await publishDocument(aClient, siteId, PATH);
  const afterPublish = await loadDocument(aClient, siteId, PATH);
  check("publish stamps published_at", typeof afterPublish.publishedAt === "string");

  await saveDocument(aClient, siteId, PATH, docV2);
  const afterEdit = await loadDocument(aClient, siteId, PATH);
  check("draft preferred over published content", docEquals(afterEdit.document, docV2));
  check("published_at survives a new draft save", typeof afterEdit.publishedAt === "string");

  console.log("\nRLS denial (user B must not touch user A's page):");
  const bRead = await loadDocument(bClient, siteId, PATH);
  check("user B cannot read user A's page (RLS hides the row)", bRead.isNew === true);

  let writeDenied = false;
  try {
    await saveDocument(bClient, siteId, "/hack-attempt", docV1);
  } catch {
    writeDenied = true;
  }
  check("user B cannot write into user A's site (RLS WITH CHECK)", writeDenied);

  console.log(`\nPASS — ${passed} checks`);
} catch (err) {
  console.error(`\n${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  console.log("\nteardown: removing test users + cascade");
  await cleanup([aId, bId]);
}
