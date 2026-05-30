import { registry as defaultRegistry } from "./components";
import type { ComponentRegistry, EditorDocument } from "./types";

// normalizeDocument — fill every block's props with its component's defaults.
//
// WHY THIS EXISTS: a block's render function assumes its props are complete
// (e.g. Text reads `level` to pick a heading tag; Hours maps over `days`). An
// AI patch can produce a *structurally* valid block — object props, known
// type — whose props are missing required keys (e.g. {heading} with no
// {level, body}). That document passes applyAIEdit's shape check, gets saved,
// and then crashes the renderer on the NEXT load (React: "Element type is
// invalid … got undefined"). The editor route blanks out and stays broken
// because the bad draft reloads every time.
//
// Merging registry defaults under each block's props closes that gap: missing
// keys get sensible values, author-supplied values win. Run it (1) inside
// applyAIEdit so new writes are always complete, and (2) on read in the
// editor/render path so documents already persisted in a broken state heal
// themselves the next time they load (and re-save complete via autosave).
//
// Shallow merge is intentional: props are flat bags; we don't want to deep-
// merge an author-provided array (e.g. Hours.days) with the default array.
export function normalizeDocument(
  document: EditorDocument,
  registry: ComponentRegistry = defaultRegistry,
): EditorDocument {
  return {
    ...document,
    blocks: document.blocks.map((block) => {
      const def = registry[block.type];
      if (!def) return block; // unknown type — leave as-is (validate rejects it)
      return {
        ...block,
        props: { ...def.defaultProps, ...block.props },
      };
    }),
  };
}
