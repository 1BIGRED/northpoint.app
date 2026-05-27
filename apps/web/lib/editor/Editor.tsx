"use client";

// The only file outside puck-adapter.ts allowed to import from
// @measured/puck. Wraps Puck behind a generic <Editor> component whose
// public surface is editor-agnostic: feed it an EditorDocument and the
// registry, get back onChange + onPublish callbacks operating on
// EditorDocument. CLAUDE.md §3 forbids direct Puck imports outside this
// module.

import "@measured/puck/puck.css";

import { Puck } from "@measured/puck";
import { useMemo } from "react";

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
  const initialData = useMemo(() => toPuckData(document), [document]);

  return (
    <Puck
      config={config}
      data={initialData}
      onChange={onChange ? (data) => onChange(fromPuckData(data)) : undefined}
      onPublish={onPublish ? (data) => onPublish(fromPuckData(data)) : undefined}
    />
  );
}
