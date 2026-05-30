"use client";

// The only file outside puck-adapter.ts allowed to import from
// @puckeditor/core. Wraps Puck behind a generic <Editor> component whose
// public surface is editor-agnostic: feed it an EditorDocument and the
// registry, get back onChange + onPublish callbacks operating on
// EditorDocument. CLAUDE.md §3 forbids direct Puck imports outside this
// module.

import "@puckeditor/core/puck.css";
import "./editor-canvas.css";

import { Puck } from "@puckeditor/core";
import { useMemo } from "react";

import { normalizeDocument } from "./normalize";
import { buildPuckConfig, fromPuckData, toPuckData } from "./puck-adapter";
import type { ComponentRegistry, EditorDocument } from "./types";

export type EditorProps = {
  registry: ComponentRegistry;
  document: EditorDocument;
  onChange?: (doc: EditorDocument) => void;
  onPublish?: (doc: EditorDocument) => void;
};

export function Editor({ registry, document, onChange, onPublish }: EditorProps) {
  const config = useMemo(() => buildPuckConfig(registry), [registry]);
  // Heal documents persisted with incomplete props (e.g. from an older AI
  // edit) before handing them to Puck, so a single bad block can't crash the
  // whole editor on load. See normalize.ts.
  const initialData = useMemo(
    () => toPuckData(normalizeDocument(document, registry)),
    [document, registry],
  );

  return (
    <Puck
      config={config}
      data={initialData}
      onChange={onChange ? (data) => onChange(fromPuckData(data)) : undefined}
      onPublish={onPublish ? (data) => onPublish(fromPuckData(data)) : undefined}
      overrides={{
        // Hide Puck's built-in header Publish button. The app renders its own
        // publish control in the editor status bar (Group E5); showing both
        // gave the editor two Publish buttons. Suppressing the built-in one
        // keeps a single, confirm-dialog-gated publish path. Containing the
        // Puck-specific override here honors the abstraction rule (§3).
        headerActions: () => <></>,
      }}
    />
  );
}
