"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentAccount } from "@/lib/account";
import { buildTemplateDocument, isTemplateId } from "@/lib/editor";
import {
  buildDocumentFromParsed,
  parseSiteHtml,
} from "@/lib/import/parse-site";
import { getSupabaseServer } from "@/lib/supabase/server";

// Create a new site for the current user's account, seed its home page with the
// chosen starter template, then drop them into the editor. The INSERT runs
// through the session client: the sites_owner_all RLS policy's WITH CHECK
// confirms the account_id belongs to the caller, so this can't create a site
// under someone else's account.
//
// `template` defaults to "blank"; a blank template leaves draft_content unset
// so the editor falls back to an empty canvas (loadDocument's behavior), while
// any other template seeds a site_pages row with the starter document.
export async function createSite(formData: FormData): Promise<void> {
  const rawName = String(formData.get("name") ?? "").trim();
  const name = rawName || "Untitled site";

  const rawTemplate = String(formData.get("template") ?? "blank");
  const template = isTemplateId(rawTemplate) ? rawTemplate : "blank";

  const account = await getCurrentAccount();
  if (!account) {
    redirect("/onboarding");
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("sites")
    .insert({ account_id: account.id, name, status: "draft" })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`createSite failed: ${error?.message ?? "no row returned"}`);
  }

  // Seed the home page with the template's starter content. Blank skips the
  // insert entirely — the editor shows its empty-canvas state instead.
  if (template !== "blank") {
    const document = buildTemplateDocument(template, name);
    const { error: pageError } = await supabase.from("site_pages").insert({
      site_id: data.id,
      path: "/",
      draft_content: document,
    });
    if (pageError) {
      throw new Error(`createSite seed failed: ${pageError.message}`);
    }
  }

  // Straight into the editor (route ships in E3 / #23).
  redirect(`/app/sites/${data.id}/edit`);
}

export type SiteActionResult =
  | { ok: true }
  | { ok: false; error: string };

// Rename a site from the sites list. Runs through the session client, so the
// sites_owner_all RLS policy guarantees the caller can only rename their own
// site (a non-owned id matches zero rows). Blank names fall back rather than
// erroring — this is an inline edit, not a form with validation.
export async function renameSite(
  siteId: string,
  name: string,
): Promise<SiteActionResult> {
  const clean = name.trim() || "Untitled site";
  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from("sites")
    .update({ name: clean, updated_at: new Date().toISOString() })
    .eq("id", siteId)
    .is("deleted_at", null);
  if (error) {
    return { ok: false, error: `Couldn't rename the site: ${error.message}` };
  }
  revalidatePath("/app/sites");
  return { ok: true };
}

// Delete a site from the sites list. This is a SOFT delete (sets deleted_at)
// per CLAUDE.md §5 "never hard delete user data" — every sites query already
// filters `deleted_at IS NULL`, so the site disappears from the list and its
// public page stops resolving, but the row (and its site_pages/chat history)
// survive and can be restored. Runs through the session client → RLS scopes it
// to the caller's own site.
export async function deleteSite(siteId: string): Promise<SiteActionResult> {
  const supabase = await getSupabaseServer();
  const { error } = await supabase
    .from("sites")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", siteId)
    .is("deleted_at", null);
  if (error) {
    return { ok: false, error: `Couldn't delete the site: ${error.message}` };
  }
  // Drop the now-hidden public page from the render cache.
  revalidatePath("/app/sites");
  revalidatePath(`/sites/${siteId}`);
  return { ok: true };
}

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 5_000_000; // 5 MB guard against pathological pages.

export type ImportSiteResult =
  | { ok: true; siteId: string }
  | { ok: false; error: string };

// Normalize user-entered URLs ("bcglassandtint.com" → "https://bcglassandtint.com").
function normalizeUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

// Import an existing site from a URL: fetch its HTML, extract structured
// content (title/hours/contact), and seed a new site + home page whose
// draft_content is the imported document. First pass — content only, no
// images or visual replication (Group D1). Robust to bad URLs / fetch
// failures: returns a structured error instead of throwing.
export async function importSiteFromUrl(
  rawUrl: string,
): Promise<ImportSiteResult> {
  const url = normalizeUrl(rawUrl);
  if (!url) {
    return { ok: false, error: "That doesn't look like a valid website URL." };
  }

  const account = await getCurrentAccount();
  if (!account) {
    return { ok: false, error: "No account found — finish onboarding first." };
  }

  // Fetch with a timeout and a real User-Agent (some hosts 403 a blank UA).
  let html: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; Northpoint-importer/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      return {
        ok: false,
        error: `Couldn't reach that site (HTTP ${response.status}).`,
      };
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      return { ok: false, error: "That URL didn't return a web page." };
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_HTML_BYTES) {
      return { ok: false, error: "That page is too large to import." };
    }
    html = new TextDecoder().decode(buffer);
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      error: aborted
        ? "That site took too long to respond."
        : "Couldn't reach that site. Check the URL and try again.",
    };
  }

  const parsed = parseSiteHtml(html);
  const document = buildDocumentFromParsed(parsed);
  const name = parsed.title ?? parsed.heading ?? url.hostname;

  const supabase = await getSupabaseServer();
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .insert({ account_id: account.id, name, status: "draft" })
    .select("id")
    .single();
  if (siteError || !site) {
    return {
      ok: false,
      error: `Couldn't create the site: ${siteError?.message ?? "no row returned"}`,
    };
  }

  // Seed the home page draft with the imported document. RLS
  // (site_pages_owner_all) confirms the site belongs to the caller.
  const { error: pageError } = await supabase.from("site_pages").insert({
    site_id: site.id,
    path: "/",
    draft_content: document,
  });
  if (pageError) {
    return {
      ok: false,
      error: `Imported the site but couldn't save its page: ${pageError.message}`,
    };
  }

  return { ok: true, siteId: site.id as string };
}
