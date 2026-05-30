import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  ComponentDefinition,
  ComponentRegistry,
  EditorDocument,
  Field,
} from "@/lib/editor";

// Builds the editor-chat system prompt. CLAUDE.md §6: prompts live as
// versioned .md files in /apps/web/prompts and are never inlined in code.
// This module loads the template and injects the dynamic context (the live
// document + the registered block types) so the rest stays human-editable.
//
// Pure and synchronous: given the same template, document, and registry it
// returns the same string, which is what makes it unit-testable with no AI
// calls (see editor-chat-prompt.test.ts).

const PROMPT_VERSION = "editor-chat-v2";

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

// Describe one field's allowed shape for the prompt's field guide. The AI was
// guessing inner shapes (e.g. it wrote Hours days as {day, hours:"9-5"} instead
// of {day, open, close}); spelling out selects' options and arrays' item fields
// removes the guesswork.
function describeField(name: string, field: Field): string {
  switch (field.kind) {
    case "select":
      return `${name} — one of: ${field.options.map((o) => `"${o.value}"`).join(", ")}`;
    case "array": {
      const items = Object.entries(field.itemFields)
        .map(([k, f]) => `${k} (${f.label ?? f.kind})`)
        .join(", ");
      return `${name} — array; each item is an object with: ${items}`;
    }
    case "number":
      return `${name} — number`;
    case "url":
      return `${name} — URL string`;
    default:
      return `${name} — text`;
  }
}

// Render one block type as a concrete schema: its exact default-props shape (a
// valid example the AI can copy and tweak) plus a field guide. Showing the
// real default props is what teaches the precise structure — e.g. that Hours
// `days` is an array of {day, open, close} with 24h "HH:MM" times and "" for a
// closed day — instead of leaving the AI to invent field names.
export function describeBlockType(def: ComponentDefinition): string {
  const fieldGuide = Object.entries(def.fields ?? {})
    .filter(([, f]) => Boolean(f))
    .map(([name, f]) => `  - ${describeField(name, f as Field)}`)
    .join("\n");
  return [
    `### \`${def.type}\` — ${def.label}`,
    `Example props (a new block's props must match this exact shape — same field names, same value formats):`,
    "```json",
    JSON.stringify(def.defaultProps, null, 2),
    "```",
    fieldGuide ? `Fields:\n${fieldGuide}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// Render the whole registry into per-block schemas for the system prompt, so
// the AI produces props that match each component exactly.
export function describeBlockTypes(registry: ComponentRegistry): string {
  return Object.values(registry).map(describeBlockType).join("\n\n");
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
