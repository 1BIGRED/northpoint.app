import { notFound, redirect } from "next/navigation";

import { editor } from "@/lib/editor";
import { findFirstUserSite, loadDocument } from "@/lib/editor/storage/supabase";
import { getSupabaseServer } from "@/lib/supabase/server";

import { SpikeEditor } from "./editor";

export const dynamic = "force-dynamic";

const DEFAULT_PATH = "/";

export default async function SpikeEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string; path?: string }>;
}) {
  // Gate per the spike spec: not available in production.
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production") {
    notFound();
  }

  // Auth-gated because the storage layer is RLS-enforced. Bouncing
  // unauthenticated users to /login keeps the access path uniform with
  // the rest of /app and /admin.
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?returnTo=/spike/editor");
  }

  const params = await searchParams;
  let siteId = params.siteId ?? "";
  if (!siteId) {
    const fallback = await findFirstUserSite();
    if (!fallback) {
      return (
        <main className="mx-auto max-w-2xl space-y-4 p-8">
          <h1 className="text-2xl font-semibold tracking-tight">No sites yet</h1>
          <p className="text-sm text-muted-foreground">
            The current user has no site rows visible. Seed one with
            <code className="ml-1 rounded bg-muted px-1.5 py-0.5 text-sm">
              pnpm db:seed-debug-site --email {user.email ?? "you@example.com"}
            </code>
            , then reload.
          </p>
        </main>
      );
    }
    siteId = fallback.id;
  }
  const path = params.path ?? DEFAULT_PATH;

  const initial = await loadDocument(siteId, path);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-semibold tracking-tight">
                Editor spike — Group E2
              </h1>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Supabase persistence
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Site <span className="font-mono">{siteId.slice(0, 8)}</span>,
              path <span className="font-mono">{path}</span>
              {initial.publishedAt ? (
                <>
                  {" · last published "}
                  <time dateTime={initial.publishedAt}>
                    {new Date(initial.publishedAt).toLocaleString()}
                  </time>
                </>
              ) : null}
              {initial.isNew ? " · new page" : null}
            </p>
          </div>
        </div>
      </header>
      <SpikeEditor
        siteId={siteId}
        path={path}
        initialDocument={initial.document ?? editor.emptyDocument()}
      />
    </main>
  );
}
