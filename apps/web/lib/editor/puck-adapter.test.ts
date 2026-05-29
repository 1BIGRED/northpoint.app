import { describe, expect, it } from "vitest";

import {
  buildPuckConfig,
  fromPuckData,
  toPuckData,
} from "./puck-adapter";
import type { ComponentDefinition, ComponentRegistry, EditorDocument } from "./types";

// A minimal stand-in registry — deliberately NOT the real components, so
// these tests exercise only the adapter's translation logic and stay pure
// (no React/JSX). The adapter only reads label/fields/defaultProps and
// wraps (never invokes) render, so omitting a real render is fine.
const fakeRegistry: ComponentRegistry = {
  Text: {
    type: "Text",
    label: "Text block",
    defaultProps: { heading: "Hi", level: "h2" },
    fields: {
      heading: { kind: "text", label: "Heading" },
      website: { kind: "url", label: "Website" },
      level: {
        kind: "select",
        label: "Level",
        options: [
          { label: "H1", value: "h1" },
          { label: "H2", value: "h2" },
        ],
      },
      count: { kind: "number", label: "Count", min: 0, max: 10 },
      links: {
        kind: "array",
        label: "Links",
        itemFields: { href: { kind: "url" }, text: { kind: "text" } },
      },
    },
  } as unknown as ComponentDefinition,
};

describe("buildPuckConfig", () => {
  const config = buildPuckConfig(fakeRegistry);
  // Puck types `fields` as optional; the adapter always sets it for our
  // components, so narrow once here for the assertions below.
  const fields = (config.components.Text.fields ?? {}) as Record<
    string,
    { type: string; [key: string]: unknown }
  >;

  it("keys components by their type", () => {
    expect(Object.keys(config.components)).toEqual(["Text"]);
  });

  it("carries through label and defaultProps", () => {
    const c = config.components.Text;
    expect(c.label).toBe("Text block");
    expect(c.defaultProps).toEqual({ heading: "Hi", level: "h2" });
  });

  it("translates each field kind to its Puck equivalent", () => {
    expect(fields.heading).toMatchObject({ type: "text", label: "Heading" });
    // url has no first-class Puck field — it maps to text.
    expect(fields.website).toMatchObject({ type: "text", label: "Website" });
    expect(fields.count).toMatchObject({ type: "number", min: 0, max: 10 });
  });

  it("preserves select options", () => {
    const select = fields.level as {
      type: string;
      options: ReadonlyArray<{ label: string; value: string }>;
    };
    expect(select.type).toBe("select");
    expect(select.options).toEqual([
      { label: "H1", value: "h1" },
      { label: "H2", value: "h2" },
    ]);
  });

  it("recurses into array item fields", () => {
    const arr = fields.links as {
      type: string;
      arrayFields: Record<string, { type: string }>;
    };
    expect(arr.type).toBe("array");
    expect(arr.arrayFields.href).toMatchObject({ type: "text" }); // url -> text
    expect(arr.arrayFields.text).toMatchObject({ type: "text" });
  });
});

describe("toPuckData", () => {
  it("folds each block's id into its props and wraps root", () => {
    const doc: EditorDocument = {
      version: 1,
      blocks: [{ id: "blk-1", type: "Text", props: { heading: "Hello" } }],
      root: { title: "Home" },
    };
    const data = toPuckData(doc);
    expect(data.content).toEqual([
      { type: "Text", props: { heading: "Hello", id: "blk-1" } },
    ]);
    expect(data.root).toEqual({ props: { title: "Home" } });
  });

  it("defaults root props to an empty object when root is absent", () => {
    const data = toPuckData({ version: 1, blocks: [] });
    expect(data.root).toEqual({ props: {} });
  });
});

describe("fromPuckData", () => {
  it("lifts id back out of props and unwraps root", () => {
    const doc = fromPuckData({
      content: [{ type: "Text", props: { heading: "Hello", id: "blk-1" } }],
      root: { props: { title: "Home" } },
    });
    expect(doc).toEqual({
      version: 1,
      blocks: [{ id: "blk-1", type: "Text", props: { heading: "Hello" } }],
      root: { title: "Home" },
    });
  });

  it("synthesizes an id when a content item has none", () => {
    const doc = fromPuckData({
      content: [{ type: "Text", props: { heading: "x" } }],
      root: { props: {} },
    });
    expect(typeof doc.blocks[0].id).toBe("string");
    expect(doc.blocks[0].id.length).toBeGreaterThan(0);
  });
});

describe("toPuckData/fromPuckData round-trip", () => {
  it("preserves blocks (id, type, props) and root", () => {
    const doc: EditorDocument = {
      version: 1,
      blocks: [
        { id: "a", type: "Text", props: { heading: "One", level: "h1" } },
        { id: "b", type: "Image", props: { src: "/x.png", alt: "x" } },
      ],
      root: { title: "Home", description: "desc" },
    };
    expect(fromPuckData(toPuckData(doc))).toEqual(doc);
  });
});
