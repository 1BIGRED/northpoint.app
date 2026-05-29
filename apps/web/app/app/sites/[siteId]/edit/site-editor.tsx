"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@northpoint/ui/components/dialog";

import { Editor, registry, type EditorDocument } from "@/lib/editor";
import { relativeTime } from "@/lib/relative-time";

import { publishAction, saveAction, unpublishAction } from "./actions";

type Props = {
  siteId: string;
  path: string;
  initialDocument: EditorDocument;
  initialPublishedAt: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_THROTTLE_MS = 500;

// Client half of the editor route. Owns autosave (trailing-edge throttle),
// publish/unpublish (each behind a confirm dialog), and the save +
// publish-status indicators. The server page renders the surrounding
// chrome (site name, back link) and feeds in the initial state.
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
  const [confirm, setConfirm] = useState<null | "publish" | "unpublish">(null);

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

  const doPublish = useCallback(() => {
    setConfirm(null);
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

  const doUnpublish = useCallback(() => {
    setConfirm(null);
    setError(null);
    startPublish(async () => {
      try {
        await unpublishAction(siteId, path);
        setPublishedAt(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setSaveState("error");
      }
    });
  }, [siteId, path]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <StatusBar
        saveState={saveState}
        savedAt={savedAt}
        publishedAt={publishedAt}
        isPublishing={isPublishing}
        error={error}
        onPublishClick={() => setConfirm("publish")}
        onUnpublishClick={() => setConfirm("unpublish")}
      />
      <div className="flex-1">
        <Editor
          registry={registry}
          document={initialDocument}
          onChange={onChange}
          onPublish={() => setConfirm("publish")}
        />
      </div>

      <PublishDialog
        kind={confirm}
        busy={isPublishing}
        onCancel={() => setConfirm(null)}
        onConfirm={confirm === "unpublish" ? doUnpublish : doPublish}
      />
    </div>
  );
}

function StatusBar({
  saveState,
  savedAt,
  publishedAt,
  isPublishing,
  error,
  onPublishClick,
  onUnpublishClick,
}: {
  saveState: SaveState;
  savedAt: string | null;
  publishedAt: string | null;
  isPublishing: boolean;
  error: string | null;
  onPublishClick: () => void;
  onUnpublishClick: () => void;
}) {
  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved" && savedAt
        ? `Saved ${new Date(savedAt).toLocaleTimeString()}`
        : saveState === "error"
          ? "Save failed"
          : "All changes saved";

  return (
    <div className="flex items-center justify-between border-b bg-white px-4 py-2 text-sm">
      <div className="flex items-center gap-3">
        <span
          className={
            saveState === "error" ? "text-red-700" : "text-muted-foreground"
          }
        >
          {saveLabel}
        </span>
        <span className="text-muted-foreground" aria-hidden>
          ·
        </span>
        {publishedAt ? (
          <span className="text-muted-foreground">
            Last published{" "}
            <time dateTime={publishedAt} title={new Date(publishedAt).toLocaleString()}>
              {relativeTime(publishedAt)}
            </time>
          </span>
        ) : (
          <span className="text-muted-foreground">Not published yet</span>
        )}
        {error ? <span className="font-mono text-xs text-red-700">{error}</span> : null}
      </div>
      <div className="flex items-center gap-3">
        {publishedAt ? (
          <button
            type="button"
            onClick={onUnpublishClick}
            disabled={isPublishing}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            Unpublish
          </button>
        ) : null}
        <button
          type="button"
          onClick={onPublishClick}
          disabled={isPublishing}
          className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/85 disabled:opacity-50"
        >
          {isPublishing ? "Working…" : publishedAt ? "Republish" : "Publish"}
        </button>
      </div>
    </div>
  );
}

function PublishDialog({
  kind,
  busy,
  onCancel,
  onConfirm,
}: {
  kind: null | "publish" | "unpublish";
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isUnpublish = kind === "unpublish";
  return (
    <Dialog open={kind !== null} onOpenChange={(open) => (open ? null : onCancel())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isUnpublish ? "Unpublish this site?" : "Publish this site?"}
          </DialogTitle>
          <DialogDescription>
            {isUnpublish
              ? "Visitors will no longer be able to see this page. Your draft and the last published version are kept, so you can republish anytime."
              : "Your latest saved changes will go live and be visible to anyone with the link."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-black/85 disabled:opacity-50"
          >
            {busy ? "Working…" : isUnpublish ? "Unpublish" : "Publish"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
