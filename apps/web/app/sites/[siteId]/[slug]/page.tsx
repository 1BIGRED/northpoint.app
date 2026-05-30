import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { registry, RenderDocument } from "@/lib/editor";
import { loadPublishedDocument } from "@/lib/editor/storage/supabase";
import { pathFromSlug } from "@/lib/site-pages/path";

// Public render for non-home pages: /sites/<id>/<slug> serves the published
// page stored at "/<slug>". The home page stays at /sites/<id> (../page.tsx).
// Mirrors the home route exactly, only the path source differs.

const getPage = cache((siteId: string, path: string) =>
  loadPublishedDocument(siteId, path),
);

function pageTitle(doc: { root?: Record<string, unknown> }): string {
  const t = doc.root?.title;
  return typeof t === "string" && t.trim() ? t : "{{PRODUCT_NAME}} site";
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
  params: Promise<{ siteId: string; slug: string }>;
}): Promise<Metadata> {
  const { siteId, slug } = await params;
  const page = await getPage(siteId, pathFromSlug(slug));
  if (!page) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }

  const title = pageTitle(page.document);
  const description = pageDescription(page.document);
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicSiteSubPage({
  params,
}: {
  params: Promise<{ siteId: string; slug: string }>;
}) {
  const { siteId, slug } = await params;
  const page = await getPage(siteId, pathFromSlug(slug));
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
