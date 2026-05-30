import { describe, expect, it } from "vitest";

import { registry } from "../components";
import { normalizeDocument } from "../normalize";
import {
  buildTemplateDocument,
  isTemplateId,
  TEMPLATES,
  type TemplateId,
} from "./index";

const ALL_IDS: TemplateId[] = ["blank", "local-service", "coming-soon"];

describe("isTemplateId", () => {
  it("accepts known ids", () => {
    for (const id of ALL_IDS) expect(isTemplateId(id)).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isTemplateId("nope")).toBe(false);
    expect(isTemplateId("")).toBe(false);
    expect(isTemplateId(undefined)).toBe(false);
    expect(isTemplateId(42)).toBe(false);
  });
});

describe("TEMPLATES metadata", () => {
  it("lists exactly the buildable templates", () => {
    expect(TEMPLATES.map((t) => t.id).sort()).toEqual([...ALL_IDS].sort());
  });
  it("puts blank first", () => {
    expect(TEMPLATES[0].id).toBe("blank");
  });
});

describe("buildTemplateDocument", () => {
  it("blank is an empty version-1 document", () => {
    const doc = buildTemplateDocument("blank");
    expect(doc.version).toBe(1);
    expect(doc.blocks).toEqual([]);
  });

  it("unknown template id falls back to blank", () => {
    // The action narrows via isTemplateId, but the builder must be safe alone.
    const doc = buildTemplateDocument("totally-bogus" as TemplateId);
    expect(doc.blocks).toEqual([]);
  });

  it("interpolates the business name into the hero heading", () => {
    const doc = buildTemplateDocument("local-service", "BC Glass & Tint");
    expect(doc.blocks[0].type).toBe("Text");
    expect(doc.blocks[0].props.heading).toBe("Welcome to BC Glass & Tint");
  });

  it("falls back to a generic name when none/placeholder is given", () => {
    expect(buildTemplateDocument("local-service").blocks[0].props.heading).toBe(
      "Welcome to your business",
    );
    expect(
      buildTemplateDocument("local-service", "Untitled site").blocks[0].props
        .heading,
    ).toBe("Welcome to your business");
  });

  it("local-service hours are Mon–Fri 9–5, Sat 10–3, Sun closed", () => {
    const doc = buildTemplateDocument("local-service");
    const hours = doc.blocks.find((b) => b.type === "Hours");
    expect(hours).toBeDefined();
    const days = hours!.props.days as Array<{
      day: string;
      open: string;
      close: string;
    }>;
    expect(days).toHaveLength(7);
    const sat = days.find((d) => d.day === "Sat")!;
    expect(sat).toEqual({ day: "Sat", open: "10:00", close: "15:00" });
    const sun = days.find((d) => d.day === "Sun")!;
    expect(sun).toEqual({ day: "Sun", open: "", close: "" });
    const mon = days.find((d) => d.day === "Mon")!;
    expect(mon).toEqual({ day: "Mon", open: "09:00", close: "17:00" });
  });

  it("coming-soon has a hero, a CTA button, and an address block", () => {
    const doc = buildTemplateDocument("coming-soon", "Acme");
    const types = doc.blocks.map((b) => b.type);
    expect(types).toContain("Text");
    expect(types).toContain("Button");
    expect(doc.blocks[0].props.heading).toBe("Acme is coming soon");
  });

  it("every non-blank template uses only registered block types", () => {
    for (const id of ["local-service", "coming-soon"] as const) {
      for (const block of buildTemplateDocument(id).blocks) {
        expect(registry[block.type]).toBeDefined();
      }
    }
  });

  it("block ids are unique within a document", () => {
    for (const id of ALL_IDS) {
      const ids = buildTemplateDocument(id, "X").blocks.map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("produces documents that survive normalization unchanged in block count", () => {
    // Templates should already carry complete props, so normalizeDocument
    // (which fills missing defaults) must not drop or add blocks.
    for (const id of ALL_IDS) {
      const doc = buildTemplateDocument(id, "X");
      const normalized = normalizeDocument(doc, registry);
      expect(normalized.blocks).toHaveLength(doc.blocks.length);
    }
  });
});
