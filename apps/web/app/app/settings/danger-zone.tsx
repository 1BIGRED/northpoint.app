"use client";

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

import { deleteAccount } from "./actions";

// Account deletion. Strong confirmation: the user must type "delete" before
// the button enables. On success the action signs them out and redirects, so
// there's no success state to render here.
export function DangerZone() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canDelete = confirm.trim().toLowerCase() === "delete";

  function onConfirm() {
    if (!canDelete || pending) return;
    setError(null);
    startTransition(async () => {
      // Resolves only on failure; success redirects away from this page.
      const result = await deleteAccount(confirm);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <section className="space-y-3 rounded-lg border border-red-200 p-4">
      <div>
        <h2 className="text-sm font-medium text-red-700">Danger zone</h2>
        <p className="text-xs text-muted-foreground">
          Deleting your account removes your profile and all your sites. Their
          public pages stop working immediately.
        </p>
      </div>
      <Button
        type="button"
        variant="destructive"
        onClick={() => {
          setConfirm("");
          setError(null);
          setOpen(true);
        }}
      >
        Delete account
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (pending ? null : setOpen(next))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This removes your profile and every site you own. Type{" "}
              <strong>delete</strong> below to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="delete"
              autoFocus
              disabled={pending}
              aria-label="Type delete to confirm"
            />
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
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={!canDelete || pending}
            >
              {pending ? "Deleting…" : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
