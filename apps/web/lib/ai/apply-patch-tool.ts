import { tool } from "ai";
import { z } from "zod";

import { applyAIEdit, type EditorDocument, type JsonPatch } from "@/lib/editor";

// The `apply_patch` AI tool — the model's only write path into the editor
// document (CLAUDE.md §6 "apply_edit(json_patch)"). The model proposes an
// RFC 6902 patch; we run it through applyAIEdit (allowlist + clone-apply +
// re-validate), persist on success, and hand the model a structured result so
// it can self-correct on failure.
//
// The handler is dependency-injected so it's unit-testable with no AI SDK and
// no database — see apply-patch-tool.test.ts.

// One RFC 6902 operation. `value`/`from` are conditionally present depending
// on `op`; applyAIEdit does the real RFC-level validation, so here we only
// need a shape loose enough for the model to fill in.
const operationSchema = z.object({
  op: z.enum(["add", "remove", "replace", "move", "copy", "test"]),
  path: z.string().describe("JSON Pointer, e.g. /blocks/0/props/heading"),
  value: z.unknown().optional(),
  from: z
    .string()
    .optional()
    .describe("Source JSON Pointer for move/copy operations"),
});

export const applyPatchInputSchema = z.object({
  patch: z
    .array(operationSchema)
    .describe("RFC 6902 JSON Patch: the ordered operations to apply."),
  summary: z
    .string()
    .describe(
      "A short, plain-language description of the change, e.g. 'Updated Saturday hours to 9–3'.",
    ),
});

export type ApplyPatchInput = {
  patch: JsonPatch;
  summary: string;
};

export type ApplyPatchResultInfo = {
  ok: boolean;
  error?: string;
  summary: string;
  patch: JsonPatch;
};

// What the tool returns to the model. Deliberately small — we do NOT echo the
// full document back (token waste + the client reloads it separately); the
// model only needs to know success/failure to decide its next step.
export type ApplyPatchOutput = {
  ok: boolean;
  error?: string;
  blockCount?: number;
};

export type ApplyPatchDeps = {
  // Current working document (advances across multiple patches in one turn).
  getDocument: () => EditorDocument;
  setDocument: (doc: EditorDocument) => void;
  // Persist the updated document (e.g. save the draft). Only called on success.
  persist: (doc: EditorDocument) => Promise<void>;
  // Side-channel for transcript/training capture + telemetry. Never throws.
  onResult?: (info: ApplyPatchResultInfo) => void;
};

// Core handler. Validate → (on success) persist + advance working doc → report.
export async function runApplyPatch(
  deps: ApplyPatchDeps,
  input: ApplyPatchInput,
): Promise<ApplyPatchOutput> {
  const result = applyAIEdit(deps.getDocument(), input.patch);

  if (!result.ok) {
    deps.onResult?.({
      ok: false,
      error: result.error,
      summary: input.summary,
      patch: input.patch,
    });
    return { ok: false, error: result.error };
  }

  await deps.persist(result.document);
  deps.setDocument(result.document);
  deps.onResult?.({ ok: true, summary: input.summary, patch: input.patch });

  return { ok: true, blockCount: result.document.blocks.length };
}

// Wrap the core handler as an AI SDK tool.
export function buildApplyPatchTool(deps: ApplyPatchDeps) {
  return tool({
    description:
      "Apply an RFC 6902 JSON Patch to the website document. Use this for every change. Only paths under /blocks and /root are allowed; never edit ids, version, or owner fields. Returns { ok } — on failure, read `error` and try a corrected patch.",
    inputSchema: applyPatchInputSchema,
    execute: (input): Promise<ApplyPatchOutput> =>
      // zod validated the shape; applyAIEdit enforces the RFC 6902 + allowlist
      // semantics. The cast bridges zod's structural type to rfc6902's union.
      runApplyPatch(deps, {
        patch: input.patch as unknown as JsonPatch,
        summary: input.summary,
      }),
  });
}
