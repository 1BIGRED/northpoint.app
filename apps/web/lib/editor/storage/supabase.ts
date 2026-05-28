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

// Publish: copy draft_content into content + stamp published_at. We
// always publish the server-side draft, not whatever the client thinks
// it is — that way a stale tab can't republish an older version.
export async function publishDocument(
  siteId: string,
  path: string,
): Promise<void> {
  const supabase = await getSupabaseServer();
  const { data, error: readError } = await supabase
    .from("site_pages")
    .select("draft_content")
    .eq("site_id", siteId)
    .eq("path", path)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError) {
    throw new Error(`publishDocument read failed: ${readError.message}`);
  }
  if (!data?.draft_content) {
    throw new Error("publishDocument: no draft to publish");
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("site_pages")
    .update({
      content: data.draft_content,
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
