// Generic editor types. Intentionally Puck-agnostic — the rest of the app
// MUST consume these via `lib/editor`'s public surface (index.ts). The
// adapter layer (puck-adapter.ts) is the only place that knows Puck exists.
// See CLAUDE.md §3 "Editor abstraction (no direct Puck leakage)".

export type BlockId = string;
export type BlockType = string;

// Each registered block type has a known props shape. The registry maps
// block type → component + default props + (in the future) AI metadata.
export type BlockProps = Record<string, unknown>;

export type Block<TType extends BlockType = BlockType, TProps extends BlockProps = BlockProps> = {
  id: BlockId;
  type: TType;
  props: TProps;
};

// The full editor document. Phase 1 keeps this flat (a list of top-level
// blocks); nested children live inside the block's own props.
export type EditorDocument = {
  version: 1;
  blocks: Block[];
  // `root` is a free-form bag for document-wide settings (theme tokens,
  // page title, etc). Phase 1 leaves it empty.
  root?: Record<string, unknown>;
};

// One entry per editable block type. The component is the React renderer
// used both inside the editor canvas AND for the published HTML — keep
// these identical for now; we can split later if SSR/CSR diverge.
export type ComponentDefinition<TProps extends BlockProps = BlockProps> = {
  type: BlockType;
  label: string;
  // Default props for a freshly inserted block.
  defaultProps: TProps;
  // Editable fields — drives the side-panel form in the editor.
  fields: FieldSchema<TProps>;
  // Render function. Pure: same props → same output.
  render: (props: TProps) => React.ReactElement;
};

// A small field-schema language so we can describe editable props without
// leaking the underlying editor's field format into component definitions.
// Each editor implementation (Puck today, something else tomorrow)
// translates this into its own field shape inside the adapter.
export type FieldSchema<TProps extends BlockProps> = {
  [K in keyof TProps]?: Field;
};

export type Field =
  // `inlineEditable` opts a text/textarea field into edit-on-canvas: in the
  // editor the rendered value becomes click-to-edit in place (the adapter maps
  // this to the underlying editor's native inline-edit support). It has no
  // effect on the published page. Leave it off for fields better edited in the
  // side panel (e.g. a Button's href).
  | { kind: "text"; label?: string; inlineEditable?: boolean }
  | { kind: "textarea"; label?: string; inlineEditable?: boolean }
  | { kind: "url"; label?: string }
  | { kind: "select"; label?: string; options: ReadonlyArray<{ label: string; value: string }> }
  | { kind: "number"; label?: string; min?: number; max?: number }
  | { kind: "array"; label?: string; itemFields: Record<string, Field> };

export type ComponentRegistry = Record<BlockType, ComponentDefinition>;

// The minimal surface the rest of the app uses to load/save/render docs.
// Implementations live in `index.ts` and delegate to the adapter.
export type EditorAPI = {
  emptyDocument: () => EditorDocument;
  listComponentTypes: () => BlockType[];
};
