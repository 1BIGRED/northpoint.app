// Server-side renderer for published documents. Along with Editor.tsx and
// puck-adapter.ts, this is one of the only files allowed to import from
// @puckeditor/core — here via the RSC-safe `/rsc` entry, so a published
// page renders to HTML on the server with none of the editor runtime
// shipped to the visitor. CLAUDE.md §3 forbids direct Puck imports
// elsewhere; the rest of the app renders documents through this component.

import { Render } from "@puckeditor/core/rsc";

import { buildPuckConfig, toPuckData } from "./puck-adapter";
import type { ComponentRegistry, EditorDocument } from "./types";

export type RenderDocumentProps = {
  registry: ComponentRegistry;
  document: EditorDocument;
};

export function RenderDocument({ registry, document }: RenderDocumentProps) {
  const config = buildPuckConfig(registry);
  const data = toPuckData(document);
  return <Render config={config} data={data} />;
}
