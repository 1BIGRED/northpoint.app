import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { registry } from "./components";
import { normalizeDocument } from "./normalize";
import type { EditorDocument } from "./types";

describe("normalizeDocument", () => {
  it("fills missing props from the registry defaults", () => {
    // The exact shape an incomplete AI patch persists: a Text with only a
    // heading (no level/body) — the block that crashed the editor on reload.
    const doc: EditorDocument = {
      version: 1,
      blocks: [{ id: "b1", type: "Text", props: { heading: "Welcome" } }],
      root: { title: "Home" },
    };
    const out = normalizeDocument(doc, registry);
    const props = out.blocks[0].props;
    expect(props.heading).toBe("Welcome"); // author value preserved
    expect(props.level).toBe(registry.Text.defaultProps.level); // default filled
    expect(props.body).toBe(registry.Text.defaultProps.body);
  });

  it("does not overwrite props the author provided", () => {
    const doc: EditorDocument = {
      version: 1,
      blocks: [
        { id: "b1", type: "Text", props: { heading: "Hi", body: "x", level: "h1" } },
      ],
    };
    const out = normalizeDocument(doc, registry);
    expect(out.blocks[0].props).toMatchObject({ heading: "Hi", body: "x", level: "h1" });
  });

  it("leaves unknown block types untouched", () => {
    const doc: EditorDocument = {
      version: 1,
      blocks: [{ id: "b1", type: "Mystery", props: { foo: 1 } }],
    };
    const out = normalizeDocument(doc, registry);
    expect(out.blocks[0]).toEqual({ id: "b1", type: "Mystery", props: { foo: 1 } });
  });

  it("preserves version and root", () => {
    const doc: EditorDocument = { version: 1, blocks: [], root: { title: "T" } };
    expect(normalizeDocument(doc, registry)).toEqual(doc);
  });
});

describe("render safety after normalization (regression: editor crash)", () => {
  it("a normalized Text block (originally missing level) renders without throwing", () => {
    const doc: EditorDocument = {
      version: 1,
      blocks: [{ id: "b1", type: "Text", props: { heading: "Welcome" } }],
    };
    const normalized = normalizeDocument(doc, registry);
    const block = normalized.blocks[0];
    expect(() =>
      renderToStaticMarkup(registry.Text.render(block.props as never)),
    ).not.toThrow();
  });

  it("Text/Hours renders are defensive even with raw incomplete props", () => {
    // Belt-and-suspenders: even WITHOUT normalization, the renderer must not
    // crash on missing level / missing days.
    expect(() =>
      renderToStaticMarkup(registry.Text.render({ heading: "x" } as never)),
    ).not.toThrow();
    expect(() =>
      renderToStaticMarkup(registry.Hours.render({ title: "Hours" } as never)),
    ).not.toThrow();
  });
});
