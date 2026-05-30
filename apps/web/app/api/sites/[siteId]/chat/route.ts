import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

import { getModel, isAIConfigured } from "@/lib/ai/anthropic";
import { buildApplyPatchTool } from "@/lib/ai/apply-patch-tool";
import { saveChatMessage } from "@/lib/ai/chat-storage";
import { MAX_CHAT_STEPS, MAX_OUTPUT_TOKENS, MODELS } from "@/lib/ai/config";
import { buildSystemPrompt } from "@/lib/ai/editor-chat-prompt";
import { registry, type EditorDocument } from "@/lib/editor";
import {
  getOwnedSite,
  loadDocument,
  saveDocument,
} from "@/lib/editor/storage/supabase";

// Editor AI chat (Group E8). Streams a Claude turn that can call apply_patch
// to edit the site document. CLAUDE.md §6: streaming routes set maxDuration
// (60 on Hobby); output continues past the deadline once headers flush.
export const maxDuration = 60;

// Single-page-per-site in Phase 1 (mirrors the editor route).
const DEFAULT_PATH = "/";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ siteId: string }> },
): Promise<Response> {
  const { siteId } = await params;

  // Ownership gate. getOwnedSite runs through the RLS session client, so a
  // row comes back only when the caller owns it — null means missing/not
  // yours, both a 404.
  const site = await getOwnedSite(siteId);
  if (!site) {
    return Response.json({ error: "Site not found." }, { status: 404 });
  }

  // Graceful missing-key path: never crash, never block the editor. The
  // client also disables the composer when AI is off, but we guard here too
  // in case the key disappears at runtime.
  if (!isAIConfigured()) {
    return Response.json(
      {
        error:
          "AI features need ANTHROPIC_API_KEY in apps/web/.env.local — see README. Manual editing still works.",
      },
      { status: 503 },
    );
  }

  let body: { messages?: UIMessage[] };
  try {
    body = (await req.json()) as { messages?: UIMessage[] };
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const messages = body.messages ?? [];

  // The document the AI edits this turn. apply_patch advances `workingDoc`
  // across multiple patches, and persists each success to the draft.
  const loaded = await loadDocument(siteId, DEFAULT_PATH);
  let workingDoc: EditorDocument = loaded.document;

  // Best-effort transcript capture (CLAUDE.md §8). Never fatal — see
  // chat-storage.ts. Persist the latest user message now.
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (lastUser) {
    void saveChatMessage(siteId, "user", lastUser.parts);
  }

  const applyPatch = buildApplyPatchTool({
    getDocument: () => workingDoc,
    setDocument: (doc) => {
      workingDoc = doc;
    },
    persist: (doc) => saveDocument(siteId, DEFAULT_PATH, doc),
    onResult: (info) => {
      // One transcript row per edit attempt: the before-less but
      // intent+patch+outcome record §8 wants for training.
      void saveChatMessage(siteId, "tool", {
        patch: info.patch,
        ok: info.ok,
        error: info.error,
        summary: info.summary,
      });
    },
  });

  const system = buildSystemPrompt({ document: workingDoc, registry });

  const result = streamText({
    model: getModel("chat"),
    system,
    messages: await convertToModelMessages(messages),
    tools: { apply_patch: applyPatch },
    stopWhen: stepCountIs(MAX_CHAT_STEPS),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    onFinish: (event) => {
      // Persist the assistant's reply for the transcript.
      if (event.text) {
        void saveChatMessage(siteId, "assistant", [
          { type: "text", text: event.text },
        ]);
      }
      // TODO(credits): replace this log with chargeCredits(userId,
      // MODELS.chat, inputTokens, outputTokens) once the credit ledger exists
      // (CLAUDE.md §6). Do not ship paid AI without metering.
      const u = event.totalUsage;
      console.info(
        `[editor-chat] site=${siteId} model=${MODELS.chat} in=${u.inputTokens ?? "?"} out=${u.outputTokens ?? "?"}`,
      );
    },
  });

  return result.toUIMessageStreamResponse();
}
