"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import { uploadSiteImage } from "@/lib/storage/upload-image";

// Drop-in image control for the editor: paste a URL OR upload a file. Built
// for the Image block's `src` (Group E4/E5). Self-contained — it resolves the
// current siteId from the editor route path so it can be wired into Puck's
// field panel without threading siteId through Puck metadata.
//
// SCAFFOLD: uploads go through uploadSiteImage (client-direct, E4 §5). Until
// the `site-media` bucket exists they fail gracefully with an inline notice;
// the URL field always works. Final wiring into the Puck Image field + visual
// QA happens when the bucket lands.

type Props = {
  value: string;
  onChange: (url: string) => void;
};

function siteIdFromPath(pathname: string | null): string | null {
  // /app/sites/<siteId>/edit
  const m = pathname?.match(/\/app\/sites\/([^/]+)\/edit/);
  return m ? m[1] : null;
}

export function ImageUploadField({ value, onChange }: Props) {
  const pathname = usePathname();
  const siteId = siteIdFromPath(pathname);
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!siteId) {
      setStatus("error");
      setError("Couldn't determine the site to upload to.");
      return;
    }
    setStatus("uploading");
    setError(null);
    const result = await uploadSiteImage(siteId, file);
    if (result.ok) {
      onChange(result.url);
      setStatus("idle");
    } else {
      setStatus("error");
      setError(result.error);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Image URL"
        className="w-full rounded-md border px-2 py-1 text-sm"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={status === "uploading"}
          className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          {status === "uploading" ? "Uploading…" : "Upload image"}
        </button>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="h-8 w-8 rounded border object-cover"
          />
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={onFile}
        className="hidden"
      />
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
