"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@northpoint/ui/components/dialog";
import { Input } from "@northpoint/ui/components/input";

import { normalizePagePath, pageLabel, sortPagePaths } from "@/lib/site-pages/path";

import { createPageAction } from "./actions";

type Props = {
  siteId: string;
  pages: string[];
  activePath: string;
};

// Page switcher strip for multi-page sites. Each page is a link that swaps the
// editor's ?path=; "+ Add page" opens a dialog that creates a page and (via the
// server action's redirect) navigates straight into it. The editor route
// remounts SiteEditor on path change, so switching pages is plain navigation.
export function PageTabs({ siteId, pages, activePath }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sorted = sortPagePaths(pages);
  // Live preview of the slug the name will become, so the user isn't surprised.
  const preview = normalizePagePath(name);

  function onCreate() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      // On success the action redirects, so this resolves only on failure.
      const result = await createPageAction(siteId, name);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-1 border-b bg-white px-4 py-1.5">
      <nav className="flex items-center gap-1 overflow-x-auto">
        {sorted.map((path) => {
          const active = path === activePath;
          return (
            <Link
              key={path}
              href={`/app/sites/${siteId}/edit?path=${encodeURIComponent(path)}`}
              aria-current={active ? "page" : undefined}
              className={
                "whitespace-nowrap rounded-md px-3 py-1 text-sm transition-colors " +
                (active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60")
              }
            >
              {pageLabel(path)}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => {
          setName("");
          setError(null);
          setOpen(true);
        }}
        className="ml-1 whitespace-nowrap rounded-md border px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
      >
        + Add page
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => (pending ? null : setOpen(next))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a page</DialogTitle>
            <DialogDescription>
              Name the page (e.g. “About” or “Contact”). It’ll live at a matching
              address on your site.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onCreate();
                }
              }}
              placeholder="About"
              autoFocus
              disabled={pending}
            />
            {preview ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Address: <code>{preview}</code>
              </p>
            ) : null}
            {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onCreate}
              disabled={pending || !preview}
              className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-black/85 disabled:opacity-50"
            >
              {pending ? "Adding…" : "Add page"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
