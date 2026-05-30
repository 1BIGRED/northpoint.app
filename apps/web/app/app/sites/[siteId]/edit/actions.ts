"use server";

import { revalidatePath } from "next/cache";

import type { EditorDocument } from "@/lib/editor";
import {
  loadDocument,
  publishDocument,
  saveDocument,
  unpublishDocument,
} from "@/lib/editor/storage/supabase";
import { getSupabaseServer } from "@/lib/supabase/server";

// Server actions for the real editor route. Thin wrappers over the
// RLS-enforced storage layer — every call runs as the user's own session,
// so an action can't touch a site the caller doesn't own (the storage
// layer's queries return/affect zero rows otherwise). Thrown errors
// serialize their `message` back to the client, which renders it.

export async function saveAction(
  siteId: string,
  path: string,
  document: EditorDocument,
): Promise<{ ok: true; savedAt: string }> {
  await saveDocument(siteId, path, document);
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function publishAction(
  siteId: string,
  path: string,
): Promise<{ ok: true; publishedAt: string }> {
  await publishDocument(siteId, path);
  const publishedAt = new Date().toISOString();
  // Bust the public render cache once that route exists (Group E6).
  revalidatePath(`/sites/${siteId}`);
  return { ok: true, publishedAt };
}

// Re-read the current draft document. The AI chat (Group E8) edits and saves
// the draft server-side via apply_patch; the client calls this after a chat
// turn to pull the updated document back into the editor canvas.
export async function reloadDocumentAction(
  siteId: string,
  path: string,
): Promise<{ ok: true; document: EditorDocument }> {
  const { document } = await loadDocument(siteId, path);
  return { ok: true, document };
}

export async function unpublishAction(
  siteId: string,
  path: string,
): Promise<{ ok: true }> {
  await unpublishDocument(siteId, path);
  // Drop the now-hidden page from the public render cache (Group E6).
  revalidatePath(`/sites/${siteId}`);
  return { ok: true };
}

// Rename a site. Goes through the RLS session client (sites_owner_all), so it
// can only rename a site the caller owns. Blank names fall back to "Untitled
// site" rather than erroring, since this is an inline edit-in-place.
export async function renameSiteAction(
  siteId: string,
  name: string,
): Promise<{ ok: true; name: string }> {
  const clean = name.trim() || "Untitled site";
  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from("sites")
    .update({ name: clean, updated_at: new Date().toISOString() })
    .eq("id", siteId)
    .is("deleted_at", null);
  if (error) {
    throw new Error(`renameSite failed: ${error.message}`);
  }
  return { ok: true, name: clean };
}
