"use server";

import { revalidatePath } from "next/cache";

import {
  loadDocument,
  publishDocument,
  saveDocument,
  type LoadResult,
} from "@/lib/editor/storage/supabase";
import type { EditorDocument } from "@/lib/editor";

// Server actions for the spike editor. Each thin-wraps the storage layer
// and bounces back the user-visible error message — Next.js serializes
// thrown errors with their `message`, which is what we want here.

export async function loadAction(
  siteId: string,
  path: string,
): Promise<LoadResult> {
  return loadDocument(siteId, path);
}

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
  // Bust any cached server-rendered pages once we have a real /published view.
  revalidatePath(`/published/${siteId}${path}`);
  return { ok: true, publishedAt };
}
