// Central model selection. CLAUDE.md §6: "Model selection lives in
// /apps/web/lib/ai/config.ts — change one constant to swap models everywhere."
//
// Phase 1 editor chat defaults to Sonnet; structural multi-block reasoning
// (restructure, large generate) uses Opus. Swap an ID here and every call
// site follows.

export const MODELS = {
  // Default for ordinary editor chat turns (small, targeted edits).
  chat: "claude-sonnet-4-6",
  // Heavier structural reasoning across many blocks (restructure / generate).
  structural: "claude-opus-4-7",
} as const;

export type ModelKey = keyof typeof MODELS;

// Per-call ceiling so a runaway tool loop can't stream forever. The editor
// chat is interactive and small; a handful of steps is plenty for "propose
// patch → see result → confirm".
export const MAX_CHAT_STEPS = 6;

// Soft cap on output tokens per chat turn. Keeps a single turn bounded; the
// real budget enforcement is the (future) credit system — see chargeCredits
// TODO in anthropic.ts.
export const MAX_OUTPUT_TOKENS = 2048;
