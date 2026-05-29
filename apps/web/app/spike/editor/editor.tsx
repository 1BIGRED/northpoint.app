"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Editor, registry, type EditorDocument } from "@/lib/editor";

import { publishAction, saveAction } from "./actions";

type Props = {
  siteId: string;
  path: string;
  initialDocument: EditorDocument;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_THROTTLE_MS = 500;

export function SpikeEditor({ siteId, path, initialDocument }: Props) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, startPublish] = useTransition();

  // Trailing-edge throttle: schedule a save SAVE_THROTTLE_MS after the
  // latest change. If more changes arrive in that window, the timer is
  // reset, so we coalesce bursts of edits into one round-trip.
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDocument = useRef<EditorDocument>(initialDocument);

  const flush = useCallback(async () => {
    pendingTimer.current = null;
    setSaveState("saving");
    setError(null);
    try {
      const result = await saveAction(siteId, path, latestDocument.current);
      setSavedAt(result.savedAt);
      setSaveState("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaveState("error");
    }
  }, [siteId, path]);

  const onChange = useCallback(
    (doc: EditorDocument) => {
      latestDocument.current = doc;
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      pendingTimer.current = setTimeout(flush, SAVE_THROTTLE_MS);
    },
    [flush],
  );

  // Cancel any pending save on unmount — and try to flush a final save
  // synchronously so a fast-close doesn't lose the last edit. Best-effort.
  useEffect(() => {
    return () => {
      if (pendingTimer.current) {
        clearTimeout(pendingTimer.current);
        // Fire and forget — page is unmounting, no UI to update.
        void saveAction(siteId, path, latestDocument.current).catch(() => undefined);
      }
    };
  }, [siteId, path]);

  const onPublish = useCallback(() => {
    setError(null);
    startPublish(async () => {
      try {
        if (pendingTimer.current) {
          clearTimeout(pendingTimer.current);
          await saveAction(siteId, path, latestDocument.current);
        }
        const result = await publishAction(siteId, path);
        setPublishedAt(result.publishedAt);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setSaveState("error");
      }
    });
  }, [siteId, path]);

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      <SaveStatusBar
        saveState={saveState}
        savedAt={savedAt}
        publishedAt={publishedAt}
        isPublishing={isPublishing}
        error={error}
        onPublish={onPublish}
      />
      <div className="flex-1">
        <Editor
          registry={registry}
          document={initialDocument}
          onChange={onChange}
          onPublish={() => onPublish()}
        />
      </div>
    </div>
  );
}

function SaveStatusBar({
  saveState,
  savedAt,
  publishedAt,
  isPublishing,
  error,
  onPublish,
}: {
  saveState: SaveState;
  savedAt: string | null;
  publishedAt: string | null;
  isPublishing: boolean;
  error: string | null;
  onPublish: () => void;
}) {
  const label =
    saveState === "saving"
      ? "Saving draft…"
      : saveState === "saved" && savedAt
        ? `Draft saved at ${new Date(savedAt).toLocaleTimeString()}`
        : saveState === "error"
          ? "Save failed"
          : "Edit to save";

  return (
    <div className="flex items-center justify-between border-b bg-white px-4 py-2 text-sm">
      <div
        className={saveState === "error" ? "text-red-700" : "text-muted-foreground"}
      >
        {label}
        {publishedAt ? (
          <span className="ml-3 text-muted-foreground">
            · published {new Date(publishedAt).toLocaleTimeString()}
          </span>
        ) : null}
        {error ? <span className="ml-3 font-mono text-xs">{error}</span> : null}
      </div>
      <button
        type="button"
        onClick={onPublish}
        disabled={isPublishing}
        className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/85 disabled:opacity-50"
      >
        {isPublishing ? "Publishing…" : "Publish"}
      </button>
    </div>
  );
}
