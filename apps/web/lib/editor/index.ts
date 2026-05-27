// Public surface for the editor abstraction module. Anything outside this
// directory MUST consume the editor through these exports. Per CLAUDE.md
// §3, no `@puckeditor/core` imports are allowed elsewhere in the codebase.

export type {
  Block,
  BlockId,
  BlockType,
  BlockProps,
  ComponentDefinition,
  ComponentRegistry,
  EditorDocument,
  Field,
  FieldSchema,
} from "./types";

export { registry } from "./components";

export { Editor, type EditorProps } from "./Editor";

import { registry } from "./components";
import type { BlockType, EditorAPI, EditorDocument } from "./types";

export const editor: EditorAPI = {
  emptyDocument: (): EditorDocument => ({ version: 1, blocks: [] }),
  listComponentTypes: (): BlockType[] => Object.keys(registry),
};
