"use client";

import { useEffect } from "react";

// Route-segment error boundary for the editor. Next.js renders this instead
// of the generic "this page couldn't load" screen when anything in the
// segment throws (e.g. a render crash from a malformed block). The editor
// must always degrade to something actionable — a message + retry + a way
// out — never a blank error page.
export default function EditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Structured log so the next crash is observable in server/Vercel logs
    // and the browser console with enough context to find it.
    console.error("[editor-error]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold tracking-tight">
          Something went wrong opening this editor
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The page hit an unexpected error. Your saved content is safe. Try
          reloading — if it keeps happening, let us know.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/85"
        >
          Try again
        </button>
        <a
          href="/app/sites"
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
        >
          Back to sites
        </a>
      </div>
    </div>
  );
}
