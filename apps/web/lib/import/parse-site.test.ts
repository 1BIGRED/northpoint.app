import { describe, expect, it } from "vitest";

import {
  buildDocumentFromParsed,
  normalizeTime,
  parseHoursLine,
  parseHoursFromText,
  parseSiteHtml,
  type ParsedSite,
} from "./parse-site";

describe("normalizeTime", () => {
  it("normalizes 12h and 24h clock strings to HH:MM", () => {
    expect(normalizeTime("9")).toBe("09:00");
    expect(normalizeTime("9:30 AM")).toBe("09:30");
    expect(normalizeTime("5:00 PM")).toBe("17:00");
    expect(normalizeTime("12 PM")).toBe("12:00");
    expect(normalizeTime("12 AM")).toBe("00:00");
    expect(normalizeTime("17:00")).toBe("17:00");
  });

  it("returns empty string for nonsense", () => {
    expect(normalizeTime("later")).toBe("");
    expect(normalizeTime("25:00")).toBe("");
  });
});

describe("parseHoursLine", () => {
  it("parses a day + time range", () => {
    expect(parseHoursLine("Monday: 9:00 AM - 5:00 PM")).toEqual({
      day: "Mon",
      open: "09:00",
      close: "17:00",
    });
    expect(parseHoursLine("Sat 10-2")).toEqual({
      day: "Sat",
      open: "10:00",
      close: "02:00",
    });
  });

  it("treats 'Closed' as empty hours", () => {
    expect(parseHoursLine("Sunday: Closed")).toEqual({
      day: "Sun",
      open: "",
      close: "",
    });
  });

  it("returns null for non-hours lines", () => {
    expect(parseHoursLine("Welcome to our shop")).toBeNull();
    expect(parseHoursLine("")).toBeNull();
  });
});

describe("parseHoursFromText", () => {
  it("collects one entry per day in week order", () => {
    const text = [
      "Monday: 9:00 AM - 5:00 PM",
      "Friday: 9:00 AM - 5:00 PM",
      "Saturday: Closed",
    ].join("\n");
    const hours = parseHoursFromText(text);
    expect(hours).toEqual([
      { day: "Mon", open: "09:00", close: "17:00" },
      { day: "Fri", open: "09:00", close: "17:00" },
      { day: "Sat", open: "", close: "" },
    ]);
  });

  it("returns null when no hours are present", () => {
    expect(parseHoursFromText("just some marketing copy")).toBeNull();
  });
});

describe("parseSiteHtml", () => {
  const html = `
    <html>
      <head>
        <title>BC Glass &amp; Tint</title>
        <meta name="description" content="Auto glass and window tinting in town." />
      </head>
      <body>
        <h1>BC Glass &amp; Tint</h1>
        <p>Quality auto glass since 1998.</p>
        <a href="tel:+12505551234">Call us</a>
        <a href="mailto:info@bcglass.example">Email</a>
        <address>123 Main St, Anytown</address>
        <div>
          Monday: 8:00 AM - 5:00 PM<br/>
          Saturday: 9:00 AM - 1:00 PM<br/>
          Sunday: Closed
        </div>
      </body>
    </html>`;

  it("extracts title, description, heading, contact, address", () => {
    const parsed = parseSiteHtml(html);
    expect(parsed.title).toBe("BC Glass & Tint");
    expect(parsed.description).toBe("Auto glass and window tinting in town.");
    expect(parsed.heading).toBe("BC Glass & Tint");
    expect(parsed.phone).toBe("+12505551234");
    expect(parsed.email).toBe("info@bcglass.example");
    expect(parsed.address).toBe("123 Main St, Anytown");
  });

  it("extracts hours when present", () => {
    const parsed = parseSiteHtml(html);
    expect(parsed.hours).toEqual([
      { day: "Mon", open: "08:00", close: "17:00" },
      { day: "Sat", open: "09:00", close: "13:00" },
      { day: "Sun", open: "", close: "" },
    ]);
  });

  it("degrades gracefully on empty/garbage HTML", () => {
    const parsed = parseSiteHtml("<html></html>");
    expect(parsed.title).toBeNull();
    expect(parsed.hours).toBeNull();
    expect(parsed.phone).toBeNull();
  });
});

describe("buildDocumentFromParsed", () => {
  function full(): ParsedSite {
    return {
      title: "BC Glass & Tint",
      description: "Auto glass since 1998.",
      heading: "BC Glass & Tint",
      phone: "+12505551234",
      email: "info@bcglass.example",
      address: "123 Main St",
      hours: [{ day: "Mon", open: "08:00", close: "17:00" }],
    };
  }

  it("produces a valid v1 document with a hero, hours, and a call button", () => {
    const doc = buildDocumentFromParsed(full());
    expect(doc.version).toBe(1);
    const types = doc.blocks.map((b) => b.type);
    expect(types).toContain("Text");
    expect(types).toContain("Hours");
    expect(types).toContain("Button");

    const hero = doc.blocks[0];
    expect(hero.type).toBe("Text");
    expect(hero.props.level).toBe("h1");
    expect(hero.props.heading).toBe("BC Glass & Tint");

    const button = doc.blocks.find((b) => b.type === "Button");
    expect(button?.props.href).toBe("tel:+12505551234");

    // Every block has a unique id.
    const ids = doc.blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("falls back to default hours and a mailto button when data is sparse", () => {
    const doc = buildDocumentFromParsed({
      title: null,
      description: null,
      heading: null,
      phone: null,
      email: "info@bcglass.example",
      address: null,
      hours: null,
    });
    const hours = doc.blocks.find((b) => b.type === "Hours");
    // Default hours block exists (7 days) so the user has something to edit.
    expect((hours?.props.days as unknown[]).length).toBe(7);
    const button = doc.blocks.find((b) => b.type === "Button");
    expect(button?.props.href).toBe("mailto:info@bcglass.example");
  });
});
