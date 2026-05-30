"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Button } from "@northpoint/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@northpoint/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@northpoint/ui/components/dropdown-menu";
import { Input } from "@northpoint/ui/components/input";

import { deleteSite, renameSite } from "./actions";

type SiteListItemProps = {
  id: string;
  name: string;
  status: string;
};

// One row in the sites list, with a kebab menu for rename + delete. Rename is
// inline (the name swaps to an input, saved on Enter / blur). Delete opens a
// confirm dialog — destructive, so it's never a single click. Both call the
// RLS-scoped server actions and refresh the list on success.
export function SiteListItem({ id, name, status }: SiteListItemProps) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(name);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function commitRename() {
    const next = value.trim() || "Untitled site";
    setValue(next);
    setRenaming(false);
    if (next === name) return; // no-op
    startTransition(async () => {
      const result = await renameSite(id, next);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
        setValue(name); // revert optimistic value
      }
    });
  }

  function cancelRename() {
    setValue(name);
    setRenaming(false);
  }

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteSite(id);
      if (result.ok) {
        setConfirmOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        {renaming ? (
          <Input
            ref={inputRef}
            value={value}
            autoFocus
            disabled={pending}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelRename();
              }
            }}
            className="max-w-xs"
            aria-label="Site name"
          />
        ) : (
          <div className="truncate font-medium">{value}</div>
        )}
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {status}
        </div>
        {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/app/sites/${id}/edit`}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Open editor
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Actions for ${value}`}
              className="rounded-md border px-2 py-1.5 text-sm leading-none hover:bg-muted focus:outline-none focus:ring-2 focus:ring-black/20"
            >
              <span aria-hidden>⋯</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setError(null);
                setRenaming(true);
              }}
            >
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-700 focus:text-red-700"
              onSelect={(e) => {
                e.preventDefault();
                setError(null);
                setConfirmOpen(true);
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(next) => (pending ? null : setConfirmOpen(next))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this site?</DialogTitle>
            <DialogDescription>
              “{value}” will be removed from your sites and its public page will
              stop working. This can be undone by support if needed.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
