"use client";

import { useRef, useState, useTransition } from "react";

import { renameSiteAction } from "./actions";

// Click-to-rename site name in the editor header. Edits in place
// (contentEditable), saves on blur or Enter, reverts on Escape. Uses the
// existing RLS-scoped renameSiteAction. Kept small and chrome-only — it does
// not touch the Puck canvas.
export function EditableSiteName({
  siteId,
  initialName,
}: {
  siteId: string;
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const ref = useRef<HTMLSpanElement>(null);
  const [, startTransition] = useTransition();

  function commit() {
    const next = (ref.current?.textContent ?? "").trim() || "Untitled site";
    if (ref.current) ref.current.textContent = next;
    if (next === name) return;
    setName(next);
    startTransition(async () => {
      try {
        await renameSiteAction(siteId, next);
      } catch {
        // Revert on failure.
        setName(initialName);
        if (ref.current) ref.current.textContent = initialName;
      }
    });
  }

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="Site name"
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          ref.current?.blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          if (ref.current) ref.current.textContent = name;
          ref.current?.blur();
        }
      }}
      className="rounded px-1 text-base font-semibold tracking-tight outline-none hover:bg-muted focus:bg-muted focus:ring-2 focus:ring-black/20"
    >
      {name}
    </span>
  );
}
