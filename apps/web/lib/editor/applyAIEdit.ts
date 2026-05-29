import { applyPatch, type Operation } from "rfc6902";

import { registry } from "./components";
import type { Block, EditorDocument } from "./types";

// applyAIEdit — the AI's only write path into an editor document.
//
// The AI proposes changes as an RFC 6902 JSON Patch. We never trust that
// patch blindly: it is (1) checked against an allowlist of editable paths so
// it can't touch identity/system fields, (2) applied to a *clone* via the
// rfc6902 library (no hand-rolled patch logic), and (3) the result is
// re-validated against our block model before we hand it back. Any failure
// returns a structured error and leaves the caller's document untouched.
//
// Per CLAUDE.md §3 this lives inside lib/editor/ — it's part of the editor
// abstraction's public surface, not something route/tool code reimplements.

export type JsonPatch = Operation[];

export type ApplyAIEditResult =
  | { ok: true; document: EditorDocument }
  | { ok: false; error: string };

// Patches may only touch the editable regions of a document: the block list
// and the document-wide `root` settings bag. Everything else — the schema
// `version`, a block's `id` (its identity), and conventional system fields
// like `owner_id` — is off limits, no matter where it appears in the path.
const FORBIDDEN_SEGMENTS = new Set(["id", "owner_id"]);

function pathSegments(path: string): string[] {
  // RFC 6901: a JSON Pointer is "" or a sequence of "/"-prefixed segments.
  if (path === "") return [];
  return path.slice(1).split("/");
}

function isEditablePath(path: string): boolean {
  const segments = pathSegments(path);
  if (segments.length === 0) return false; // whole-document replace — never.

  // Only the block list and root settings are editable.
  if (segments[0] !== "blocks" && segments[0] !== "root") return false;

  // No segment may target an identity/system field — this is what blocks
  // e.g. "/blocks/0/id" while still allowing "/blocks/-" (add) whose *value*
  // legitimately carries an id.
  return !segments.some((seg) => FORBIDDEN_SEGMENTS.has(seg));
}

// Operations carry a `path`, and move/copy additionally carry a `from`;
// both endpoints must be editable.
function offendingPath(op: Operation): string | null {
  if (!isEditablePath(op.path)) return op.path;
  const from = (op as { from?: string }).from;
  if (typeof from === "string" && !isEditablePath(from)) return from;
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Re-validate the post-patch document against our block model: it must still
// be a v1 document whose every block has a string id, a registered type, and
// an object props bag. This is what catches a patch that "succeeds" as JSON
// but leaves something the renderer/editor couldn't load.
function validateDocument(doc: unknown): string | null {
  if (!isPlainObject(doc)) return "document is not an object";
  if (doc.version !== 1) return "document.version must be 1";
  if (!Array.isArray(doc.blocks)) return "document.blocks must be an array";
  if (doc.root !== undefined && !isPlainObject(doc.root)) {
    return "document.root must be an object";
  }

  for (let i = 0; i < doc.blocks.length; i++) {
    const block = doc.blocks[i] as Partial<Block>;
    if (!isPlainObject(block)) return `block ${i} is not an object`;
    if (typeof block.id !== "string" || block.id.length === 0) {
      return `block ${i} has no valid id`;
    }
    if (typeof block.type !== "string" || !(block.type in registry)) {
      return `block ${i} has unknown type "${String(block.type)}"`;
    }
    if (!isPlainObject(block.props)) {
      return `block ${i} (${block.type}) has invalid props`;
    }
  }
  return null;
}

export function applyAIEdit(
  document: EditorDocument,
  patch: JsonPatch,
): ApplyAIEditResult {
  if (!Array.isArray(patch)) {
    return { ok: false, error: "patch must be an array of operations" };
  }

  // 1) Allowlist check — before touching anything.
  for (const op of patch) {
    const bad = offendingPath(op);
    if (bad !== null) {
      return {
        ok: false,
        error: `operation on forbidden path "${bad}" — only /blocks and /root are editable (and never id/owner_id/version)`,
      };
    }
  }

  // 2) Apply to a clone so the caller's document is never mutated, even on
  //    partial failure. Empty patch → unchanged clone.
  const draft = structuredClone(document) as EditorDocument;
  const results = applyPatch(draft, patch);
  const firstError = results.find((r) => r !== null);
  if (firstError) {
    return { ok: false, error: `patch failed to apply: ${firstError.message}` };
  }

  // 3) Re-validate the shape.
  const invalid = validateDocument(draft);
  if (invalid) {
    return { ok: false, error: `patch produced an invalid document: ${invalid}` };
  }

  return { ok: true, document: draft };
}
