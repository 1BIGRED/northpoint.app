"use client";

import { useEffect, useState } from "react";

import { Editor, editor, registry, type EditorDocument } from "@/lib/editor";

const STORAGE_KEY = "spike-e1-editor-doc";

function readFromStorage(): EditorDocument | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EditorDocument;
    if (parsed.version !== 1 || !Array.isArray(parsed.blocks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage(doc: EditorDocument) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch {
    // localStorage quota exceeded / private mode — best-effort only.
  }
}

export function SpikeEditor() {
  const [document, setDocument] = useState<EditorDocument | null>(null);

  useEffect(() => {
    // Hydration-safe load: localStorage is browser-only, so we read it
    // post-mount. The lint rule flags setState in effects in general; for
    // one-shot hydration on mount it's the right pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDocument(readFromStorage() ?? editor.emptyDocument());
  }, []);

  if (document === null) {
    return (
      <div className="flex h-[calc(100vh-6rem)] items-center justify-center text-sm text-muted-foreground">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-6rem)]">
      <Editor
        registry={registry}
        document={document}
        onChange={(doc) => writeToStorage(doc)}
        onPublish={(doc) => {
          console.info("[spike-e1] publish payload:", JSON.stringify(doc, null, 2));
          window.alert(
            `Logged published JSON to console.\n${doc.blocks.length} blocks.`,
          );
        }}
      />
    </div>
  );
}
