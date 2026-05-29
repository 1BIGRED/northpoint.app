import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { registry, RenderDocument } from "@/lib/editor";
import { loadPublishedDocument } from "@/lib/editor/storage/supabase";

// Phase 1 sites are single-page; the public route always serves "/".
const PATH = "/";

// Memoized per request so generateMetadata and the page body share one
// database read instead of querying twice.
const getPage = cache((siteId: string) => loadPublishedDocument(siteId, PATH));

function pageTitle(doc: { root?: Record<string, unknown> }): string {
  const t = doc.root?.title;
  return typeof t === "string" && t.trim() ? t : "{{PRODUCT_NAME}} site";
}

function pageDescription(doc: { root?: Record<string, unknown> }): string | undefined {
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

  const title = pageTitle(page.document);
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <RenderDocument registry={registry} document={page.document} />
    </main>
  );
}
