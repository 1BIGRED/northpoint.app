# Group E1 — Puck go/no-go spike

**Date:** 2026-05-27
**Branch:** `spike/e1-puck-poc`
**PR:** (draft)
**Verdict:** **GO** — continue with Puck behind the abstraction. See full reasoning at the end.

---

## What this spike covers

PHASE_1.md gates Group E (the editor) on a 1–2 day go/no-go spike. This is that spike. Time spent: ~½ day. Goal was not to ship anything — only to answer "does Puck handle the editing needs Phase 1 actually has, or are we walking into a wall?"

The spike route is `/spike/editor` (gated to non-production via `NEXT_PUBLIC_VERCEL_ENV`). State persists to `localStorage` because PR #16 (sites + site_pages) hasn't landed yet — Supabase persistence comes for free once that's in.

## Architecture

```
apps/web/lib/editor/
  ├── types.ts            Editor-agnostic types (EditorDocument, Block, ComponentDefinition, Field schema)
  ├── components/         Block definitions in our shape — Puck-unaware
  │     ├── text.tsx
  │     ├── image.tsx
  │     ├── hours.tsx
  │     ├── button.tsx
  │     ├── section.tsx
  │     └── index.ts      Aggregates into `registry`
  ├── puck-adapter.ts     The ONLY adapter — translates our schema ⇄ Puck Config/Data
  ├── Editor.tsx          The ONLY React component touching <Puck/>. Public surface: <Editor registry document onChange onPublish />
  └── index.ts            Public exports — everything outside lib/editor/ imports from here
```

`grep -r '@puckeditor/core' --include='*.ts*' apps/web/` confirms the only direct Puck imports are inside `lib/editor/` (Editor.tsx + puck-adapter.ts). The abstraction rule from CLAUDE.md §3 holds.

## What worked cleanly

- **Out-of-the-box drag-and-drop.** Components sidebar, canvas, drag handles, drop indicators — Puck does all of it. No interaction code to write.
- **Field-form auto-generation.** Each block declares its props + a tiny field schema (`{ kind: 'text' | 'textarea' | 'url' | 'select' | 'number' | 'array' }`); Puck renders a right-side panel form from the schema. Editing flows just work.
- **Undo / redo** built-in. Viewport switcher (mobile / tablet / desktop) built-in.
- **`onChange` + `onPublish`** callbacks accept editor-state and surface clean serializable JSON. Round-trips through `localStorage` survived a refresh test.
- **The abstraction held.** Wrapping Puck behind our `<Editor>` + adapter took ~50 lines total. The rest of the app sees a generic editor interface.
- **Build clean, typecheck clean** with the editor route + Puck included.

## Painful spots / workarounds applied

- **`@measured/puck` was deprecated mid-spike.** The initial spike commit used the deprecated `@measured/puck@0.20.2` because the auto-mode classifier blocked the package swap. The founder pre-authorized the swap in Batch 3, and `@puckeditor/core@0.21.2` is now what this branch installs. The API surface was identical — the only changes were the import strings and the CSS path. Manual smoke against the new package passed (`/spike/editor` loaded, all 5 blocks in the sidebar, no JS console errors).
- **TS generic invariance.** Storing `ComponentDefinition<TextProps>` alongside `ComponentDefinition<ButtonProps>` in one registry required a deliberate `as unknown as ComponentDefinition[]` cast in `components/index.ts`. Isolated to one file; noted with a comment.
- **No first-class URL field type in Puck.** Mapped `kind: "url"` to Puck's `text` field in the adapter. Cosmetic — adds no client-side validation. Easy to layer Zod validation on top in `Editor.tsx` later.
- **Puck CSS import** (`@puckeditor/core/puck.css`) has to live inside the abstraction (it does, in `Editor.tsx`). Means custom theming routes through `lib/editor/` rather than via consumer overrides — fine for now.

## Missing for shipping (Phase 1)

| Gap | Spike status | Effort to close | Blocked on |
|---|---|---|---|
| Supabase persistence (load + save EditorDocument) | localStorage only | 4–6 h | PR #16 merge |
| SSR / published HTML view via `<Render>` | not exercised | 2–3 h | nothing |
| `applyAIEdit(json_patch)` (RFC 6902) over EditorDocument | not exercised | 3–4 h | nothing |
| Nested children in Section via Puck DropZone | placeholder only | 4–6 h | nothing |
| Image upload (Supabase Storage, presigned URL) | URL input only | 8–12 h | Supabase Storage bucket |
| ~~Swap `@measured/puck` → `@puckeditor/core`~~ | **done in this PR** | — | — |

Sum: **roughly 3 days of integration** on top of the spike's ½ day. Compares to PHASE_1.md's estimate of 12–14 days for a from-scratch custom editor.

## Recommendation: GO

**Continue with Puck.** The reasoning:

1. **The expensive parts work today.** Drag-drop UX, field-form auto-generation, undo/redo, viewport switching are the high-cost components of a visual editor; Puck delivers them for free.
2. **The abstraction holds.** Only two files in the codebase import Puck. A future swap to Plasmic / Builder.io / custom is a contained refactor in `lib/editor/` — exactly the contingency CLAUDE.md §3 was designed for.
3. **Remaining gaps are integration work, not capability gaps.** Persistence, SSR, AI patches, nested children — all standard work, all well-understood in Puck's API.
4. **Bus-factor risk is real but bounded.** The package being deprecated mid-spike is a small signal in that direction. Mitigation: pin to a known-good version, plan the `@puckeditor/core` swap before Group F's launch, keep the abstraction strict.
5. **Custom editor is a ~12–14 day undertaking** that delays the BC Glass launch (mid-June target) significantly. The marginal risk of Puck vs. custom doesn't justify ~9 extra days of build-out for the alpha.

## Open questions for the founder (resolved in Batch 3)

All three resolved:

1. ~~OK to swap to `@puckeditor/core`?~~ — **yes, rolled into this PR.**
2. ~~Stay on localStorage until PR #16 merges?~~ — **yes**, no rebase onto d1.
3. ~~Hours block default labels English Mon–Sun?~~ — **yes**, confirmed for Phase 1.

## Test plan if/when this PR un-drafts

- [ ] Manual: drag each of the 5 block types onto the canvas, edit fields in the right panel, refresh, confirm state restored
- [ ] Manual: click "Publish", confirm JSON in console matches the on-canvas state
- [ ] Smoke: extend `playwright/tests/` with a `/spike/editor` test once Group F lands
