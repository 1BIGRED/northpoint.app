"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Editor, registry, type EditorDocument } from "@/lib/editor";

import { publishAction, saveAction } from "./actions";

type Props = {
  siteId: string;
  path: string;
  initialDocument: EditorDocument;
  initialPublishedAt: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_THROTTLE_MS = 500;

// Client half of the editor route. Owns autosave (trailing-edge throttle),
// publish, and the save-status indicator. The server page renders the
// surrounding chrome (site name, back link) and feeds in the initial doc.
export function SiteEditor({
  siteId,
  path,
  initialDocument,
  initialPublishedAt,
}: Props) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(
    initialPublishedAt,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, startPublish] = useTransition();

  // Trailing-edge throttle: coalesce a burst of edits into one save fired
  // SAVE_THROTTLE_MS after the latest change.
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

  // On unmount, cancel the pending timer and best-effort flush the last
  // edit so a fast navigation away doesn't drop it.
  useEffect(() => {
    return () => {
      if (pendingTimer.current) {
        clearTimeout(pendingTimer.current);
        void saveAction(siteId, path, latestDocument.current).catch(
          () => undefined,
        );
      }
    };
  }, [siteId, path]);

  const onPublish = useCallback(() => {
    setError(null);
    startPublish(async () => {
      try {
        // Flush any in-flight draft first so we publish the latest state.
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
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
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
      ? "Saving…"
      : saveState === "saved" && savedAt
        ? `Saved ${new Date(savedAt).toLocaleTimeString()}`
        : saveState === "error"
          ? "Save failed"
          : "All changes saved";

  return (
    <div className="flex items-center justify-between border-b bg-white px-4 py-2 text-sm">
      <div
        className={
          saveState === "error" ? "text-red-700" : "text-muted-foreground"
        }
      >
        {label}
        {publishedAt ? (
          <span className="ml-3">
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
