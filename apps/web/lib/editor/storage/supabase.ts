import "server-only";

import { getSupabaseServer } from "@/lib/supabase/server";

import type { EditorDocument } from "../types";

// RLS-enforced editor persistence. Every call uses the cookie-bound
// Supabase client (the user's own session) — never the service role
// from a request path. The account-owner-all policies on site_pages
// (PR #16) gate access; an attacker holding only an anon key can't
// read or write rows that don't belong to their authenticated user.

function emptyDocument(): EditorDocument {
  return { version: 1, blocks: [] };
}

function isEditorDocument(value: unknown): value is EditorDocument {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<EditorDocument>;
  return v.version === 1 && Array.isArray(v.blocks);
}

export type LoadResult = {
  document: EditorDocument;
  publishedAt: string | null;
  // True if the row didn't exist yet and we're returning a blank canvas.
  isNew: boolean;
};

// Load the editing document for a (site, path). Prefers draft_content
// (in-progress) over content (last-published). Returns an empty doc when
// the page row hasn't been created yet.
export async function loadDocument(
  siteId: string,
  path: string,
): Promise<LoadResult> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("site_pages")
    .select("draft_content, content, published_at")
    .eq("site_id", siteId)
    .eq("path", path)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`loadDocument failed: ${error.message}`);
  }

  if (!data) {
    return { document: emptyDocument(), publishedAt: null, isNew: true };
  }

  const candidate = data.draft_content ?? data.content;
  const document = isEditorDocument(candidate) ? candidate : emptyDocument();
  return {
    document,
    publishedAt: (data.published_at as string | null) ?? null,
    isNew: false,
  };
}

// Save to draft_content. Upserts the row so the editor can seed a
// brand-new page without a separate "create page" step. updated_at is
// stamped server-side here so it advances on every save, not only on
// insert (the column default is `now()` which only fires once).
export async function saveDocument(
  siteId: string,
  path: string,
  document: EditorDocument,
): Promise<void> {
  if (!isEditorDocument(document)) {
    throw new Error("saveDocument: not a valid EditorDocument");
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.from("site_pages").upsert(
    {
      site_id: siteId,
      path,
      draft_content: document,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "site_id,path" },
  );

  if (error) {
    throw new Error(`saveDocument failed: ${error.message}`);
  }
}

// Publish: copy the current document into content + stamp published_at.
// We publish the server-side state, not whatever the client thinks it is —
// that way a stale tab can't republish an older version. The source is
// `draft_content ?? content`, mirroring what loadDocument shows the editor:
// a page with edits publishes the draft; a page with only previously
// published content (e.g. seeded, or being re-published) publishes that.
export async function publishDocument(
  siteId: string,
  path: string,
): Promise<void> {
  const supabase = await getSupabaseServer();
  const { data, error: readError } = await supabase
    .from("site_pages")
    .select("draft_content, content")
    .eq("site_id", siteId)
    .eq("path", path)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError) {
    throw new Error(`publishDocument read failed: ${readError.message}`);
  }
  const toPublish = data?.draft_content ?? data?.content;
  if (!toPublish) {
    throw new Error("publishDocument: nothing to publish");
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("site_pages")
    .update({
      content: toPublish,
      published_at: now,
      updated_at: now,
    })
    .eq("site_id", siteId)
    .eq("path", path)
    .is("deleted_at", null);

  if (updateError) {
    throw new Error(`publishDocument update failed: ${updateError.message}`);
  }
}

export type PublishedPage = {
  document: EditorDocument;
  publishedAt: string;
};

// Load a PUBLISHED page for the public render route. Reads only `content`
// (never the draft) and only when published_at is set. Returns null when
// the page doesn't exist or isn't published — the route turns that into a
// 404. Runs through the ordinary session client: on a public request that
// client is the `anon` role, and the site_pages_public_read RLS policy
// (migration 0004) is what makes published rows visible. No service role.
export async function loadPublishedDocument(
  siteId: string,
  path: string,
): Promise<PublishedPage | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("site_pages")
    .select("content, published_at")
    .eq("site_id", siteId)
    .eq("path", path)
    .not("published_at", "is", null)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`loadPublishedDocument failed: ${error.message}`);
  }
  if (!data || !data.published_at || !isEditorDocument(data.content)) {
    return null;
  }
  return { document: data.content, publishedAt: data.published_at as string };
}

export type OwnedSite = {
  id: string;
  name: string;
  status: string;
  domain: string | null;
};

// Fetch a single site by id, scoped to the current user. RLS (the
// sites_owner_all policy) is the authority here: a row comes back ONLY
// when the authenticated user owns it, so a null result means "missing
// or not yours" — callers treat both as a 404. This is the server-side
// ownership check for the editor route.
export async function getOwnedSite(siteId: string): Promise<OwnedSite | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("sites")
    .select("id, name, status, domain")
    .eq("id", siteId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id as string,
    name: data.name as string,
    status: data.status as string,
    domain: (data.domain as string | null) ?? null,
  };
}

// Unpublish: clear published_at so the public render route stops serving
// the page (it gates on published_at). We intentionally keep `content`
// intact — unpublishing hides the page, it doesn't discard the last
// published snapshot, so re-publishing the current draft stays a one-click
// action and nothing is lost.
export async function unpublishDocument(
  siteId: string,
  path: string,
): Promise<void> {
  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from("site_pages")
    .update({ published_at: null, updated_at: new Date().toISOString() })
    .eq("site_id", siteId)
    .eq("path", path)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`unpublishDocument failed: ${error.message}`);
  }
}

export type PageSummary = {
  path: string;
  publishedAt: string | null;
};

// List a site's pages (one row per path) for the editor's page switcher.
// RLS-scoped via the session client, so it only returns pages of a site the
// caller owns. Home ("/") may not have a row yet on a brand-new site — the
// caller is responsible for always offering "/" even when this is empty.
export async function listPages(siteId: string): Promise<PageSummary[]> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("site_pages")
    .select("path, published_at")
    .eq("site_id", siteId)
    .is("deleted_at", null)
    .order("path", { ascending: true });

  if (error) {
    throw new Error(`listPages failed: ${error.message}`);
  }
  return (data ?? []).map((row) => ({
    path: row.path as string,
    publishedAt: (row.published_at as string | null) ?? null,
  }));
}

// Create a new (empty-draft) page at `path` for a site. RLS (site_pages_owner_
// all) gates it to the caller's own site. Fails if the path is already taken —
// the unique (site_id, path) index also enforces this, but we check first for
// a friendly message (and soft-deleted rows still occupy their slot).
export async function createPage(
  siteId: string,
  path: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await getSupabaseServer();

  const { data: existing, error: readError } = await supabase
    .from("site_pages")
    .select("id, deleted_at")
    .eq("site_id", siteId)
    .eq("path", path)
    .maybeSingle();
  if (readError) {
    return { ok: false, error: `Couldn't check existing pages: ${readError.message}` };
  }
  if (existing) {
    return { ok: false, error: "A page with that name already exists." };
  }

  const { error } = await supabase.from("site_pages").insert({
    site_id: siteId,
    path,
    draft_content: emptyDocument(),
  });
  if (error) {
    return { ok: false, error: `Couldn't create the page: ${error.message}` };
  }
  return { ok: true };
}

// Pick the first non-deleted site owned by the current authenticated
// user. /spike/editor uses this when no siteId query param is provided
// so the developer doesn't have to look up UUIDs.
export async function findFirstUserSite(): Promise<{ id: string; name: string } | null> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("sites")
    .select("id, name")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { id: data.id as string, name: data.name as string };
}
