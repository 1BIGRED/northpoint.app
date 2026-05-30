"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { EditorDocument } from "@/lib/editor";
import {
  createPage,
  loadDocument,
  publishDocument,
  saveDocument,
  unpublishDocument,
} from "@/lib/editor/storage/supabase";
import { HOME_PATH, normalizePagePath, slugFromPath } from "@/lib/site-pages/path";

// The public URL for a (site, path): home is /sites/<id>, others are
// /sites/<id>/<slug>. Used to bust the right render cache on publish/unpublish.
function publicPath(siteId: string, path: string): string {
  const slug = slugFromPath(path);
  return slug ? `/sites/${siteId}/${slug}` : `/sites/${siteId}`;
}

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
  // Bust the public render cache for this specific page.
  revalidatePath(publicPath(siteId, path));
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
  // Drop the now-hidden page from the public render cache.
  revalidatePath(publicPath(siteId, path));
  return { ok: true };
}

// Create a new page from a user-entered name and switch the editor to it.
// Normalizes the name to a canonical "/slug" path, rejects names that
// collapse to nothing or to the home path, and redirects into the new page
// on success. Returns a structured error otherwise so the dialog can show it.
export async function createPageAction(
  siteId: string,
  rawName: string,
): Promise<{ ok: false; error: string }> {
  const path = normalizePagePath(rawName);
  if (!path) {
    return { ok: false, error: "Enter a page name (letters or numbers)." };
  }
  if (path === HOME_PATH) {
    return { ok: false, error: "That name is reserved for the home page." };
  }

  const result = await createPage(siteId, path);
  if (!result.ok) {
    return result;
  }

  revalidatePath(`/app/sites/${siteId}/edit`);
  // Switch the editor to the freshly created page. redirect() throws to
  // navigate, so it runs only after the create succeeds.
  redirect(`/app/sites/${siteId}/edit?path=${encodeURIComponent(path)}`);
}
