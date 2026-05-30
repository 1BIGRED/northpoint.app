import * as cheerio from "cheerio";

import type { EditorDocument } from "@/lib/editor";

// First-pass site importer (Group D1). Given a fetched HTML string, pull out
// the structured facts a small-business site almost always has — name,
// tagline, phone, email, hours — and shape them into our editor block types.
// This is deliberately NOT a visual clone: we extract content, not layout.
//
// Pure + synchronous (no network): parseSiteHtml takes HTML, the fetching
// lives in the server action. That keeps this unit-testable with fixtures.

export type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export type ParsedDayHours = { day: DayKey; open: string; close: string };

export type ParsedSite = {
  title: string | null;
  description: string | null;
  heading: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  hours: ParsedDayHours[] | null;
};

const DAY_ALIASES: Record<string, DayKey> = {
  mon: "Mon",
  monday: "Mon",
  tue: "Tue",
  tues: "Tue",
  tuesday: "Tue",
  wed: "Wed",
  weds: "Wed",
  wednesday: "Wed",
  thu: "Thu",
  thur: "Thu",
  thurs: "Thu",
  thursday: "Thu",
  fri: "Fri",
  friday: "Fri",
  sat: "Sat",
  saturday: "Sat",
  sun: "Sun",
  sunday: "Sun",
};

const DAY_ORDER: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function clean(text: string | undefined | null): string | null {
  if (!text) return null;
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Normalize "9", "9:30", "9 AM", "5:00 PM", "17:00" → "HH:MM" 24h, or "" if
// we can't make sense of it.
export function normalizeTime(raw: string): string {
  const m = raw
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return "";
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const meridiem = m[3];
  if (hour > 23 || minute > 59) return "";
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// Parse a single hours line like "Monday: 9:00 AM - 5:00 PM",
// "Sat 10-2", or "Sunday: Closed". Returns null if it isn't an hours line.
export function parseHoursLine(line: string): ParsedDayHours | null {
  const dayMatch = line
    .trim()
    .toLowerCase()
    .match(/^([a-z]+)\b/);
  if (!dayMatch) return null;
  const day = DAY_ALIASES[dayMatch[1]];
  if (!day) return null;

  const rest = line.slice(dayMatch[0].length);
  if (/closed/i.test(rest)) {
    return { day, open: "", close: "" };
  }

  // Find two clock-ish tokens separated by a dash/"to".
  const range = rest.match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|–|—|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );
  if (!range) return null;
  const open = normalizeTime(range[1]);
  const close = normalizeTime(range[2]);
  if (!open || !close) return null;
  return { day, open, close };
}

// Scan whole-document text for hours lines. Collapses to one entry per day
// (last wins). Returns null when nothing parseable is found.
export function parseHoursFromText(text: string): ParsedDayHours[] | null {
  const found = new Map<DayKey, ParsedDayHours>();
  for (const rawLine of text.split(/\n|·|•|\||;/)) {
    const parsed = parseHoursLine(rawLine);
    if (parsed) found.set(parsed.day, parsed);
  }
  if (found.size === 0) return null;
  return DAY_ORDER.filter((d) => found.has(d)).map(
    (d) => found.get(d) as ParsedDayHours,
  );
}

function firstPhone(text: string): string | null {
  // North-American-ish pattern; intentionally conservative to avoid grabbing
  // arbitrary number runs.
  const m = text.match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  return m ? clean(m[0]) : null;
}

function firstEmail(text: string): string | null {
  const m = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+\b/);
  return m ? m[0] : null;
}

export function parseSiteHtml(html: string): ParsedSite {
  const $ = cheerio.load(html);

  const ogTitle = $('meta[property="og:title"]').attr("content");
  const title =
    clean($("title").first().text()) ?? clean(ogTitle) ?? null;

  const description =
    clean($('meta[name="description"]').attr("content")) ??
    clean($('meta[property="og:description"]').attr("content")) ??
    null;

  const heading = clean($("h1").first().text());

  // Prefer explicit tel:/mailto: links, then fall back to scanning text.
  const bodyText = $("body").text();
  const telHref = $('a[href^="tel:"]').first().attr("href");
  const phone = telHref
    ? clean(telHref.replace(/^tel:/i, ""))
    : firstPhone(bodyText);

  const mailHref = $('a[href^="mailto:"]').first().attr("href");
  const email = mailHref
    ? clean(mailHref.replace(/^mailto:/i, ""))
    : firstEmail(bodyText);

  const address = clean($("address").first().text());

  const hours = parseHoursFromText(bodyText);

  return { title, description, heading, phone, email, address, hours };
}

const DEFAULT_HOURS: ParsedDayHours[] = [
  { day: "Mon", open: "09:00", close: "17:00" },
  { day: "Tue", open: "09:00", close: "17:00" },
  { day: "Wed", open: "09:00", close: "17:00" },
  { day: "Thu", open: "09:00", close: "17:00" },
  { day: "Fri", open: "09:00", close: "17:00" },
  { day: "Sat", open: "", close: "" },
  { day: "Sun", open: "", close: "" },
];

// Map parsed facts onto editor blocks. Always produces a usable home page:
// a hero heading, an optional about paragraph, a contact button (tel: when we
// have a phone), and an Hours block (parsed or a sensible default the user
// can edit). Block ids are deterministic so the output is test-stable.
export function buildDocumentFromParsed(parsed: ParsedSite): EditorDocument {
  const blocks: EditorDocument["blocks"] = [];
  let n = 0;
  const id = () => `imported-${++n}`;

  const name = parsed.heading ?? parsed.title ?? "Your business";
  blocks.push({
    id: id(),
    type: "Text",
    props: {
      heading: name,
      body: parsed.description ?? "Welcome — tell visitors what you do here.",
      level: "h1",
    },
  });

  if (parsed.address) {
    blocks.push({
      id: id(),
      type: "Text",
      props: { heading: "Find us", body: parsed.address, level: "h2" },
    });
  }

  blocks.push({
    id: id(),
    type: "Hours",
    props: { title: "Hours", days: parsed.hours ?? DEFAULT_HOURS },
  });

  // Surface every contact method we found as its own actionable button. A
  // shop usually has both a phone and an email; importing should carry both
  // (the phone is primary). If neither was found, no contact button — the
  // user adds one in the editor.
  if (parsed.phone) {
    blocks.push({
      id: id(),
      type: "Button",
      props: {
        label: `Call ${parsed.phone}`,
        href: `tel:${parsed.phone.replace(/[^\d+]/g, "")}`,
        variant: "primary",
      },
    });
  }
  if (parsed.email) {
    blocks.push({
      id: id(),
      type: "Button",
      props: {
        label: parsed.phone ? "Email us" : "Get a quote",
        href: `mailto:${parsed.email}`,
        // Secondary when a primary call button is already present.
        variant: parsed.phone ? "secondary" : "primary",
      },
    });
  }

  return { version: 1, blocks, root: { title: parsed.title ?? name } };
}

export { DEFAULT_HOURS };
