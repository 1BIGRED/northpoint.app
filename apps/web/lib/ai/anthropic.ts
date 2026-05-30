import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

import { MODELS, type ModelKey } from "./config";

// The single entry point for Anthropic access. CLAUDE.md §6: "All Anthropic
// API calls go through /apps/web/lib/ai/anthropic.ts — no direct SDK calls
// scattered through the codebase. Wraps the provider from @ai-sdk/anthropic."
//
// We don't construct the provider at module load: ANTHROPIC_API_KEY may be
// absent in dev/CI, and importing this file must never throw (the editor has
// to load and stay usable without AI configured — see isAIConfigured).

export function isAIConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cachedProvider: ReturnType<typeof createAnthropic> | null = null;

function getProvider() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Callers must gate on isAIConfigured() first; this guards the contract.
    throw new Error(
      "ANTHROPIC_API_KEY is not set — AI features are disabled. Add it to apps/web/.env.local (see .env.example).",
    );
  }
  if (!cachedProvider) {
    cachedProvider = createAnthropic({ apiKey });
  }
  return cachedProvider;
}

// Resolve a model by role (chat | structural) into a LanguageModel the AI SDK
// can stream. Keeping the indirection here means a model swap is a one-line
// change in config.ts and nothing else moves.
export function getModel(key: ModelKey = "chat"): LanguageModel {
  return getProvider()(MODELS[key]);
}

// TODO(credits): CLAUDE.md §6 requires wrapping every AI call with
// chargeCredits(userId, modelName, inputTokens, outputTokens). The credit
// ledger doesn't exist yet (no table), so for now the chat route logs usage
// from streamText's onFinish. Wire this up when the credit system lands so
// editor chat starts metering — do NOT ship paid AI without it.
export type UsageEvent = {
  model: string;
  inputTokens: number;
  outputTokens: number;
};
