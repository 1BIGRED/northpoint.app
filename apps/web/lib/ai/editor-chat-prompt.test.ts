import { describe, expect, it } from "vitest";

import { registry, type EditorDocument } from "@/lib/editor";

import {
  buildSystemPrompt,
  describeBlockTypes,
  PROMPT_VERSION,
} from "./editor-chat-prompt";

// Deterministic, no AI calls — these exercise system-prompt construction only.

function sampleDoc(): EditorDocument {
  return {
    version: 1,
    blocks: [
      {
        id: "blk-1",
        type: "Text",
        props: { heading: "Welcome", body: "Hi", level: "h1" },
      },
    ],
    root: { title: "Home" },
  };
}

describe("describeBlockTypes", () => {
  it("lists every registered block type with its label", () => {
    const text = describeBlockTypes(registry);
    for (const def of Object.values(registry)) {
      expect(text).toContain(`\`${def.type}\``);
      expect(text).toContain(def.label);
    }
  });

  it("includes each block's exact default-props shape as an example", () => {
    const text = describeBlockTypes(registry);
    // The whole point of the v2 fix: the Hours schema must show the real
    // per-day {day, open, close} shape so the AI stops inventing {day, hours}.
    expect(text).toContain('"open"');
    expect(text).toContain('"close"');
    // The default props JSON for Hours appears verbatim.
    expect(text).toContain(JSON.stringify(registry.Hours.defaultProps, null, 2));
  });

  it("spells out select options and array item fields", () => {
    const text = describeBlockTypes(registry);
    // Text.level options.
    expect(text).toContain('"h1"');
    expect(text).toContain('"h2"');
    // Hours days is described as an array with day/open/close items.
    expect(text).toMatch(/days — array/);
  });
});

describe("buildSystemPrompt", () => {
  it("uses the versioned prompt template", () => {
    expect(PROMPT_VERSION).toBe("editor-chat-v2");
  });

  it("embeds the live document as pretty JSON", () => {
    const doc = sampleDoc();
    const prompt = buildSystemPrompt({ document: doc, registry });
    // The exact serialized document must appear so the model sees real state.
    expect(prompt).toContain(JSON.stringify(doc, null, 2));
    expect(prompt).toContain('"heading": "Welcome"');
  });

  it("injects the available block types", () => {
    const prompt = buildSystemPrompt({ document: sampleDoc(), registry });
    expect(prompt).toContain(describeBlockTypes(registry));
    // A known registered type shows up.
    expect(prompt).toContain("`Text`");
  });

  it("explains the apply_patch tool and the editable-path rules", () => {
    const prompt = buildSystemPrompt({ document: sampleDoc(), registry });
    expect(prompt).toContain("apply_patch");
    expect(prompt).toContain("/blocks");
    expect(prompt).toContain("/root");
    // The hard prohibitions the server enforces are stated to the model.
    expect(prompt.toLowerCase()).toContain("never");
    expect(prompt).toContain("id");
  });

  it("leaves no unfilled template placeholders for dynamic context", () => {
    const prompt = buildSystemPrompt({ document: sampleDoc(), registry });
    expect(prompt).not.toContain("{{BLOCK_TYPES}}");
    expect(prompt).not.toContain("{{DOCUMENT_JSON}}");
  });
});
