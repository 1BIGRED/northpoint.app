"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { TEMPLATES, type TemplateId } from "@/lib/editor";
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

import { createSite } from "./actions";

// "Create a new site" entry point. Opens a modal that takes a name and a
// starter template, then hands off to the createSite server action (which
// seeds the home page and redirects into the editor). The template choice
// rides along as a hidden input so the whole thing stays a single native form
// submission — no extra client/server round-trip.
//
// Default selection is the local-service template: a fresh site lands with
// real content to edit, which demos far better than an empty canvas. "Blank"
// is one click away for anyone who wants to start clean.
export function CreateSiteButton() {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<TemplateId>("local-service");

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Create new site
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={createSite}>
            <DialogHeader>
              <DialogTitle>Create a new site</DialogTitle>
              <DialogDescription>
                Give it a name and pick a starting point. You can change
                anything later — or ask the AI to.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Input
                name="name"
                placeholder="Site name (e.g. BC Glass & Tint)"
                autoFocus
              />

              {/* Carries the picked template into the server action. */}
              <input type="hidden" name="template" value={template} />

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Start from</legend>
                <div className="grid gap-2">
                  {TEMPLATES.map((t) => {
                    const selected = t.id === template;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setTemplate(t.id)}
                        className={`rounded-md border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-black/20 ${
                          selected
                            ? "border-black bg-muted"
                            : "border-input hover:bg-muted/50"
                        }`}
                      >
                        <div className="text-sm font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <SubmitButton />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Separate component so it can read the parent form's pending state via
// useFormStatus (only available inside a <form>).
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create site"}
    </Button>
  );
}
