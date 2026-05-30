import { getSupabase } from "@/lib/supabase/client";

// Client-direct image upload for the editor's Image block (Group E4/E5).
//
// Per docs/E4_STORAGE_BUCKET_DESIGN.md §5 we upload straight from the browser
// using the session client — NOT through a Next.js route/server action. That
// keeps RLS (`site_media_owner_insert`) the single authority and avoids
// streaming file bytes through a serverless function. Objects live at
// `site-media/<siteId>/<uuid>.<ext>`; the bucket is public so the returned URL
// is directly renderable.
//
// SCAFFOLD: the `site-media` bucket + its RLS policies do not exist yet (E4 is
// still a design). Until they're created, uploads fail — we detect the
// "bucket not found" case and return a clear, non-fatal message instead of
// throwing. This is wired up end-to-end the moment the bucket lands.

export const BUCKET = "site-media";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB (E4 §6)

// Raster only — SVG is excluded for a public, inline-served bucket (E4 §6).
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type UploadImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

const BUCKET_PENDING_MESSAGE =
  "Image upload isn't configured yet — the storage bucket is pending. You can still paste an image URL.";

function extensionFor(file: File): string {
  const fromType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  if (fromType[file.type]) return fromType[file.type];
  const dot = file.name.lastIndexOf(".");
  return dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "bin";
}

// Pure validation, split out so it's unit-testable without a browser/network.
export function validateImageFile(file: {
  type: string;
  size: number;
}): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "That file type isn't supported. Use a JPG, PNG, WebP, or GIF.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "That image is too large (max 5 MB).";
  }
  return null;
}

// True when a Supabase Storage error means the bucket isn't created yet.
function isBucketMissing(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("bucket not found") || m.includes("not found");
}

export async function uploadSiteImage(
  siteId: string,
  file: File,
): Promise<UploadImageResult> {
  const invalid = validateImageFile(file);
  if (invalid) return { ok: false, error: invalid };

  const path = `${siteId}/${crypto.randomUUID()}.${extensionFor(file)}`;

  try {
    const supabase = getSupabase();
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) {
      return {
        ok: false,
        error: isBucketMissing(error.message)
          ? BUCKET_PENDING_MESSAGE
          : `Upload failed: ${error.message}`,
      };
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Upload failed.",
    };
  }
}

export { BUCKET_PENDING_MESSAGE };
