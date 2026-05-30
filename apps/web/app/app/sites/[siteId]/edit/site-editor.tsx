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
import { Toaster } from "@northpoint/ui/components/sonner";

import { Editor, registry, type EditorDocument } from "@/lib/editor";
import { relativeTime } from "@/lib/relative-time";

import type { ChatHistoryMessage } from "@/lib/ai/chat-storage";

import { ChatPanel } from "./chat-panel";
import {
  publishAction,
  reloadDocumentAction,
  saveAction,
  unpublishAction,
} from "./actions";

type Props = {
  siteId: string;
  path: string;
  initialDocument: EditorDocument;
  initialPublishedAt: string | null;
  // Whether the server has ANTHROPIC_API_KEY configured (gates the AI chat).
  aiEnabled: boolean;
  // Prior chat transcript, loaded server-side, to seed the chat panel.
  initialChatMessages: ChatHistoryMessage[];
};

type SaveState = "idle" | "saving" | "saved" | "retrying" | "error";

const SAVE_THROTTLE_MS = 500;
// On a failed save we retry once automatically after this delay before
// surfacing a hard failure to the user.
const SAVE_RETRY_DELAY_MS = 1500;

// Client half of the editor route. Owns autosave (trailing-edge throttle),
// publish/unpublish (each behind a confirm dialog), and the save +
// publish-status indicators. The server page renders the surrounding
// chrome (site name, back link) and feeds in the initial state.
export function SiteEditor({
  siteId,
  path,
  initialDocument,
  initialPublishedAt,
  aiEnabled,
  initialChatMessages,
}: Props) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(
    initialPublishedAt,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, startPublish] = useTransition();
  const [confirm, setConfirm] = useState<null | "publish" | "unpublish">(null);

  // Chat sidebar visibility + the document the canvas renders. AI edits land
  // server-side (apply_patch saves the draft), so we re-key the Editor with
  // the reloaded document to reflect them — `editorKey` forces a remount.
  const [chatOpen, setChatOpen] = useState(false);
  const [editorDoc, setEditorDoc] = useState<EditorDocument>(initialDocument);
  const [editorKey, setEditorKey] = useState(0);

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
    } catch (firstErr) {
      // Auto-retry once before declaring failure — most save errors are
      // transient (a dropped connection, a cold serverless function). The
      // indicator shows "Save failed — retrying…" during the backoff.
      setError(firstErr instanceof Error ? firstErr.message : String(firstErr));
      setSaveState("retrying");
      await new Promise((resolve) => setTimeout(resolve, SAVE_RETRY_DELAY_MS));
      try {
        const result = await saveAction(siteId, path, latestDocument.current);
        setSavedAt(result.savedAt);
        setSaveState("saved");
        setError(null);
      } catch (secondErr) {
        setError(
          secondErr instanceof Error ? secondErr.message : String(secondErr),
        );
        setSaveState("error");
      }
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

  // After the AI applies an edit, pull the freshly-saved draft back from the
  // server and remount the canvas so the change is visible. The chat route
  // already persisted it, so there's nothing to save here.
  const onAppliedEdit = useCallback(() => {
    void reloadDocumentAction(siteId, path)
      .then((result) => {
        latestDocument.current = result.document;
        setEditorDoc(result.document);
        setEditorKey((k) => k + 1);
        setSavedAt(new Date().toISOString());
        setSaveState("saved");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
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
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((open) => !open)}
        onPublishClick={() => setConfirm("publish")}
        onUnpublishClick={() => setConfirm("unpublish")}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="min-w-0 flex-1">
          <Editor
            key={editorKey}
            registry={registry}
            document={editorDoc}
            onChange={onChange}
            onPublish={() => setConfirm("publish")}
          />
        </div>
        {chatOpen ? (
          <ChatPanel
            siteId={siteId}
            aiEnabled={aiEnabled}
            initialMessages={initialChatMessages}
            onAppliedEdit={onAppliedEdit}
          />
        ) : null}
      </div>

      <PublishDialog
        kind={confirm}
        busy={isPublishing}
        onCancel={() => setConfirm(null)}
        onConfirm={confirm === "unpublish" ? doUnpublish : doPublish}
      />
      <Toaster />
    </div>
  );
}

function StatusBar({
  saveState,
  savedAt,
  publishedAt,
  isPublishing,
  error,
  chatOpen,
  onToggleChat,
  onPublishClick,
  onUnpublishClick,
}: {
  saveState: SaveState;
  savedAt: string | null;
  publishedAt: string | null;
  isPublishing: boolean;
  error: string | null;
  chatOpen: boolean;
  onToggleChat: () => void;
  onPublishClick: () => void;
  onUnpublishClick: () => void;
}) {
  // One source of truth for the save indicator: text, color, and an optional
  // hover tooltip. "saved" shows a plain "Saved" with a "Last saved Xs ago"
  // tooltip driven by the throttled save timestamp.
  const save: { label: string; className: string; title?: string } =
    saveState === "saving"
      ? { label: "Saving…", className: "text-muted-foreground" }
      : saveState === "retrying"
        ? { label: "Save failed — retrying…", className: "text-amber-700" }
        : saveState === "error"
          ? { label: "Couldn’t save", className: "text-red-700" }
          : saveState === "saved" && savedAt
            ? {
                label: "Saved",
                className: "text-muted-foreground",
                title: `Last saved ${relativeTime(savedAt)}`,
              }
            : { label: "All changes saved", className: "text-muted-foreground" };

  return (
    <div className="flex items-center justify-between border-b bg-white px-4 py-2 text-sm">
      <div className="flex items-center gap-3">
        <span className={save.className} title={save.title}>
          {save.label}
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
        {saveState === "error" && error ? (
          <span className="font-mono text-xs text-red-700">{error}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleChat}
          aria-pressed={chatOpen}
          className={
            "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors " +
            (chatOpen
              ? "border-black bg-black text-white"
              : "hover:bg-muted")
          }
        >
          Ask
        </button>
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
