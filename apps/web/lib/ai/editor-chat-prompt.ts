import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ComponentRegistry, EditorDocument } from "@/lib/editor";

// Builds the editor-chat system prompt. CLAUDE.md §6: prompts live as
// versioned .md files in /apps/web/prompts and are never inlined in code.
// This module loads the template and injects the dynamic context (the live
// document + the registered block types) so the rest stays human-editable.
//
// Pure and synchronous: given the same template, document, and registry it
// returns the same string, which is what makes it unit-testable with no AI
// calls (see editor-chat-prompt.test.ts).

const PROMPT_VERSION = "editor-chat-v1";

// Resolved from the web app root. process.cwd() is the app directory under
// `next dev`, `next build`/Vercel (project root = apps/web), and vitest
// (`vitest run` in apps/web). next.config's outputFileTracingIncludes ensures
// the prompts dir ships with the serverless bundle.
function loadTemplate(): string {
  return readFileSync(
    join(process.cwd(), "prompts", `${PROMPT_VERSION}.md`),
    "utf8",
  );
}

// Render the registry into a compact, model-readable list of block types and
// their editable fields, so the AI knows what it's allowed to create/edit.
export function describeBlockTypes(registry: ComponentRegistry): string {
  const lines = Object.values(registry).map((def) => {
    const fieldKeys = Object.keys(def.fields ?? {});
    const fields =
      fieldKeys.length > 0 ? fieldKeys.join(", ") : "(no editable fields)";
    return `- \`${def.type}\` — ${def.label}. Props: ${fields}`;
  });
  return lines.join("\n");
}

export type BuildSystemPromptArgs = {
  document: EditorDocument;
  registry: ComponentRegistry;
};

export function buildSystemPrompt({
  document,
  registry,
}: BuildSystemPromptArgs): string {
  const template = loadTemplate();
  return template
    .replaceAll("{{BLOCK_TYPES}}", describeBlockTypes(registry))
    .replaceAll("{{DOCUMENT_JSON}}", JSON.stringify(document, null, 2));
}

export { PROMPT_VERSION };
