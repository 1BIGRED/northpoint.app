"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@northpoint/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@northpoint/ui/components/dialog";
import { Input } from "@northpoint/ui/components/input";

import { importSiteFromUrl } from "./actions";

// "Import existing site" entry point on the sites list. Opens a small modal
// that takes a URL, runs the server-side importer, and drops the user into
// the editor for the new site. Errors render inline; the editor isn't blocked.
export function ImportSiteButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await importSiteFromUrl(url);
      if (result.ok) {
        router.push(`/app/sites/${result.siteId}/edit`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Import existing site
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (pending ? null : setOpen(next))}
      >
        <DialogContent>
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Import an existing site</DialogTitle>
              <DialogDescription>
                Enter a website URL and we’ll pull in the basics — business
                name, hours, and contact info — as an editable draft. We don’t
                copy the design, just the content.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Input
                name="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="bcglassandtint.com"
                autoFocus
                disabled={pending}
              />
              {error ? (
                <p className="mt-2 text-sm text-red-700">{error}</p>
              ) : null}
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
              <Button type="submit" disabled={pending || url.trim().length === 0}>
                {pending ? "Importing…" : "Import"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
