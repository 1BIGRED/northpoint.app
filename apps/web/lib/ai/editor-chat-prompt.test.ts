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
});

describe("buildSystemPrompt", () => {
  it("uses the versioned prompt template", () => {
    expect(PROMPT_VERSION).toBe("editor-chat-v1");
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
