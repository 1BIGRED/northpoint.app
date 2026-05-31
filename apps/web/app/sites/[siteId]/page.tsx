import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { registry, RenderDocument } from "@/lib/editor";
import { loadPublishedDocument } from "@/lib/editor/storage/supabase";

// Phase 1 sites are single-page; the public route always serves "/".
const PATH = "/";

// Memoized per request so generateMetadata and the page body share one
// database read instead of querying twice.
const getPage = cache((siteId: string) => loadPublishedDocument(siteId, PATH));

// The public-facing name of a site. By design (migration 0004) anon visitors
// can't read the `sites` table, so the name comes from the published
// document's root.title — which templates seed with the business name.
// Returns null when unset so callers can fall back gracefully.
function siteName(doc: { root?: Record<string, unknown> }): string | null {
  const t = doc.root?.title;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

function pageDescription(doc: {
  root?: Record<string, unknown>;
}): string | undefined {
  const d = doc.root?.description;
  return typeof d === "string" && d.trim() ? d : undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteId: string }>;
}): Promise<Metadata> {
  const { siteId } = await params;
  const page = await getPage(siteId);
  if (!page) {
    // Unpublished/missing: don't leak a real title, and keep it out of
    // search indexes. The page itself 404s.
    return { title: "Not found", robots: { index: false, follow: false } };
  }

  // The browser tab / SEO title is the site's own name.
  const title = siteName(page.document) ?? "Northpoint site";
  const description = pageDescription(page.document);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const page = await getPage(siteId);
  if (!page) {
    // Missing or unpublished — RLS hides unpublished rows from anon, so
    // loadPublishedDocument returns null and we 404.
    notFound();
  }

  const name = siteName(page.document);

  // Sticky-footer column: header at top, content fills, footer pinned to the
  // bottom on short pages. Content is centered with the same max-width as the
  // editor canvas so the published page matches what was edited.
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <header className="border-b border-gray-100">
        <div className="mx-auto w-full max-w-3xl px-5 py-4 sm:px-6 sm:py-5">
          <span className="text-base font-semibold tracking-tight sm:text-lg">
            {name ?? "Untitled site"}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-6 sm:py-10">
        <RenderDocument registry={registry} document={page.document} />
      </main>

      <footer className="border-t border-gray-100">
        <div className="mx-auto w-full max-w-3xl px-5 py-6 text-xs text-gray-500 sm:px-6">
          {name ? `${name} · ` : ""}Made with{" "}
          <Link
            href="/"
            className="font-medium text-gray-700 underline-offset-4 hover:text-gray-900 hover:underline"
          >
            Northpoint
          </Link>
        </div>
      </footer>
    </div>
  );
}
