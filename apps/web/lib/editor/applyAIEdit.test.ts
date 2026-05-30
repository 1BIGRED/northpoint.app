import { describe, expect, it } from "vitest";

import { applyAIEdit, type JsonPatch } from "./applyAIEdit";
import type { EditorDocument } from "./types";

// A valid starting document using real registered block types (Text/Image).
function baseDoc(): EditorDocument {
  return {
    version: 1,
    blocks: [
      { id: "blk-1", type: "Text", props: { heading: "Hello", body: "x", level: "h2" } },
      { id: "blk-2", type: "Image", props: { src: "/a.png", alt: "a" } },
    ],
    root: { title: "Home" },
  };
}

describe("applyAIEdit", () => {
  it("applies a replace on a block's text content", () => {
    const patch: JsonPatch = [
      { op: "replace", path: "/blocks/0/props/heading", value: "Updated" },
    ];
    const result = applyAIEdit(baseDoc(), patch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.blocks[0].props.heading).toBe("Updated");
      // Other content is untouched.
      expect(result.document.blocks[1].props.src).toBe("/a.png");
    }
  });

  it("applies an add that appends a new valid block", () => {
    const patch: JsonPatch = [
      {
        op: "add",
        path: "/blocks/-",
        value: {
          id: "blk-3",
          type: "Button",
          props: { label: "Book now", href: "/contact" },
        },
      },
    ];
    const result = applyAIEdit(baseDoc(), patch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.blocks).toHaveLength(3);
      expect(result.document.blocks[2]).toMatchObject({ id: "blk-3", type: "Button" });
    }
  });

  it("fills missing props with defaults so an incomplete block can't crash the renderer (regression)", () => {
    // The bug: an AI adds a Text with only {heading} — valid shape, but no
    // `level`, which crashed the editor on the next load. applyAIEdit must
    // normalize the result so the persisted block is complete.
    const patch: JsonPatch = [
      {
        op: "add",
        path: "/blocks/-",
        value: { id: "blk-3", type: "Text", props: { heading: "Welcome" } },
      },
    ];
    const result = applyAIEdit(baseDoc(), patch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const added = result.document.blocks[2];
      expect(added.props.heading).toBe("Welcome");
      // Missing required props are filled from the registry defaults.
      expect(added.props.level).toBeDefined();
      expect(added.props.body).toBeDefined();
    }
  });

  it("rejects a patch that tries to mutate a block id", () => {
    const patch: JsonPatch = [
      { op: "replace", path: "/blocks/0/id", value: "hacked" },
    ];
    const result = applyAIEdit(baseDoc(), patch);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/forbidden path/i);
      expect(result.error).toContain("/blocks/0/id");
    }
  });

  it("rejects a patch on a forbidden top-level path (version / document id)", () => {
    // Neither /version nor a synthetic /id is under /blocks or /root.
    const result = applyAIEdit(baseDoc(), [
      { op: "replace", path: "/version", value: 2 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/forbidden path/i);

    const result2 = applyAIEdit(baseDoc(), [
      { op: "add", path: "/id", value: "doc-1" },
    ]);
    expect(result2.ok).toBe(false);
  });

  it("rejects a patch that leaves an invalid block shape", () => {
    // Path is allowed (/blocks/0), but the new value isn't a valid block:
    // unknown type + no props. The post-apply re-validation must catch it.
    const patch: JsonPatch = [
      { op: "replace", path: "/blocks/0", value: { id: "blk-1", type: "Bogus" } },
    ];
    const result = applyAIEdit(baseDoc(), patch);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/invalid document/i);
    }
  });

  it("returns ok with an unchanged document for an empty patch", () => {
    const doc = baseDoc();
    const result = applyAIEdit(doc, []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document).toEqual(doc);
      // The original is not mutated (a clone is returned).
      expect(result.document).not.toBe(doc);
    }
  });

  it("does not mutate the input document when a patch fails", () => {
    const doc = baseDoc();
    applyAIEdit(doc, [{ op: "replace", path: "/blocks/0/id", value: "x" }]);
    expect(doc.blocks[0].id).toBe("blk-1");
  });
});
