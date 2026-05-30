import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isAIConfigured } from "@/lib/ai/anthropic";
import { loadChatHistory } from "@/lib/ai/chat-storage";
import { editor } from "@/lib/editor";
import { getOwnedSite, loadDocument } from "@/lib/editor/storage/supabase";
import { getSupabaseServer } from "@/lib/supabase/server";

import { EditableSiteName } from "./editable-site-name";
import { SiteEditor } from "./site-editor";

export const dynamic = "force-dynamic";

// Phase 1 is single-page-per-site; the editor always operates on "/".
// Multi-page sites add a path selector later.
const DEFAULT_PATH = "/";

export default async function SiteEditPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;

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

  const initial = await loadDocument(siteId, DEFAULT_PATH);
  // Seed the chat panel with this site's prior transcript so the conversation
  // persists across reloads. Empty array when AI is off or there's no history.
  const chatHistory = isAIConfigured() ? await loadChatHistory(siteId) : [];

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
            <EditableSiteName siteId={siteId} initialName={site.name} />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {site.status}
            </span>
          </div>
        </div>
        {/* Preview the live public page — only meaningful once published. */}
        {initial.publishedAt ? (
          <a
            href={`/sites/${siteId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Preview live site ↗
          </a>
        ) : (
          <span className="text-sm text-muted-foreground" title="Publish this site to get a live preview link.">
            Publish to preview
          </span>
        )}
      </header>
      <SiteEditor
        siteId={siteId}
        path={DEFAULT_PATH}
        initialDocument={initial.document ?? editor.emptyDocument()}
        initialPublishedAt={initial.publishedAt}
        aiEnabled={isAIConfigured()}
        initialChatMessages={chatHistory}
      />
    </main>
  );
}
