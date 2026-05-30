import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isAIConfigured } from "@/lib/ai/anthropic";
import { loadChatHistory } from "@/lib/ai/chat-storage";
import { editor } from "@/lib/editor";
import {
  getOwnedSite,
  listPages,
  loadDocument,
} from "@/lib/editor/storage/supabase";
import { HOME_PATH, normalizePagePath } from "@/lib/site-pages/path";
import { getSupabaseServer } from "@/lib/supabase/server";

import { PageTabs } from "./page-tabs";
import { SiteEditor } from "./site-editor";

export const dynamic = "force-dynamic";

export default async function SiteEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ path?: string }>;
}) {
  const { siteId } = await params;
  const { path: rawPath } = await searchParams;

  // Which page is being edited. ?path= carries the canonical "/slug" (or "/"
  // for home); normalize defensively and fall back to home.
  const activePath = rawPath ? (normalizePagePath(rawPath) ?? HOME_PATH) : HOME_PATH;

  // Auth gate — the storage layer is RLS-enforced, so an unauthenticated
  // request would see nothing anyway; bounce to login for a clean path.
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?returnTo=/app/sites/${siteId}/edit`);
  }

  // Server-side ownership check: getOwnedSite returns a row only when the
  // current user owns it (RLS). Missing-or-not-yours both 404.
  const site = await getOwnedSite(siteId);
  if (!site) {
    notFound();
  }

  const initial = await loadDocument(siteId, activePath);
  // Seed the chat panel with this site's prior transcript so the conversation
  // persists across reloads. Empty array when AI is off or there's no history.
  const chatHistory = isAIConfigured() ? await loadChatHistory(siteId) : [];

  // Page list for the switcher. A brand-new site may have no rows yet (the
  // home page is created on first save), so always offer "/" even when absent.
  const pages = await listPages(siteId);
  const pagePaths = pages.map((p) => p.path);
  if (!pagePaths.includes(HOME_PATH)) pagePaths.unshift(HOME_PATH);

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b bg-white px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/app/sites"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Sites
          </Link>
          <div className="flex items-baseline gap-2">
            <h1 className="text-base font-semibold tracking-tight">
              {site.name}
            </h1>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {site.status}
            </span>
          </div>
        </div>
      </header>
      <PageTabs siteId={siteId} pages={pagePaths} activePath={activePath} />
      <SiteEditor
        // Remount when the active page changes so the editor's internal state
        // (document, save status) resets cleanly for the newly loaded page.
        key={activePath}
        siteId={siteId}
        path={activePath}
        initialDocument={initial.document ?? editor.emptyDocument()}
        initialPublishedAt={initial.publishedAt}
        aiEnabled={isAIConfigured()}
        initialChatMessages={chatHistory}
      />
    </main>
  );
}
