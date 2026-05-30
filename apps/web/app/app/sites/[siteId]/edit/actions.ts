"use server";

import { revalidatePath } from "next/cache";

import type { EditorDocument } from "@/lib/editor";
import {
  publishDocument,
  saveDocument,
  unpublishDocument,
} from "@/lib/editor/storage/supabase";

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

export async function unpublishAction(
  siteId: string,
  path: string,
): Promise<{ ok: true }> {
  await unpublishDocument(siteId, path);
  // Drop the now-hidden page from the public render cache (Group E6).
  revalidatePath(`/sites/${siteId}`);
  return { ok: true };
}
