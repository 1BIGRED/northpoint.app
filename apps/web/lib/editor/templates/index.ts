// Starter templates for new sites. A template is a pure function from an
// optional business name to a canonical EditorDocument — no Puck types, no I/O
// — so it lives behind the editor abstraction (CLAUDE.md §3) and is trivially
// unit-testable. The create-site flow picks one and seeds the new site's
// home-page draft with its output.

import type { EditorDocument } from "../types";

export type TemplateId = "blank" | "local-service" | "coming-soon";

export type TemplateMeta = {
  id: TemplateId;
  name: string;
  description: string;
};

// Drives the picker UI. Order = display order; "blank" first as the neutral
// default.
export const TEMPLATES: readonly TemplateMeta[] = [
  {
    id: "blank",
    name: "Blank",
    description: "An empty canvas. Start from scratch or let the AI build it.",
  },
  {
    id: "local-service",
    name: "Local service business",
    description:
      "Hero, opening hours, and call/email buttons — ready to edit. Best for shops and trades.",
  },
  {
    id: "coming-soon",
    name: "Coming soon",
    description: "A single-screen teaser with one call to action and your address.",
  },
] as const;

export function isTemplateId(value: unknown): value is TemplateId {
  return (
    value === "blank" || value === "local-service" || value === "coming-soon"
  );
}

// Block ids are deterministic per template (prefix + counter) rather than
// random: a template's output is pure and reproducible, which keeps tests
// stable and makes seeded documents diffable. They're unique within a document,
// which is all the editor requires.
function blockIdFactory(templateId: TemplateId) {
  let n = 0;
  return () => `${templateId}-${++n}`;
}

function fallbackName(businessName?: string): string {
  const trimmed = businessName?.trim();
  return trimmed && trimmed !== "Untitled site" ? trimmed : "your business";
}

function blankTemplate(): EditorDocument {
  return { version: 1, blocks: [], root: {} };
}

function localServiceTemplate(businessName?: string): EditorDocument {
  const id = blockIdFactory("local-service");
  const name = fallbackName(businessName);
  return {
    version: 1,
    root: { title: businessName?.trim() || "Home" },
    blocks: [
      {
        id: id(),
        type: "Text",
        props: {
          heading: `Welcome to ${name}`,
          body: "Quality work, fair prices, and friendly service you can count on.",
          level: "h1",
        },
      },
      {
        id: id(),
        type: "Text",
        props: {
          heading: "What we do",
          body: "Tell visitors about your services here — what you offer, who you help, and what makes you the right choice.",
          level: "h2",
        },
      },
      {
        id: id(),
        type: "Hours",
        props: {
          title: "Hours",
          days: [
            { day: "Mon", open: "09:00", close: "17:00" },
            { day: "Tue", open: "09:00", close: "17:00" },
            { day: "Wed", open: "09:00", close: "17:00" },
            { day: "Thu", open: "09:00", close: "17:00" },
            { day: "Fri", open: "09:00", close: "17:00" },
            { day: "Sat", open: "10:00", close: "15:00" },
            { day: "Sun", open: "", close: "" },
          ],
        },
      },
      {
        id: id(),
        type: "Text",
        props: {
          heading: "Get in touch",
          body: "Call or email us — we'll get back to you the same day.",
          level: "h2",
        },
      },
      {
        id: id(),
        type: "Button",
        props: { label: "Call us", href: "tel:5551234567", variant: "primary" },
      },
      {
        id: id(),
        type: "Button",
        props: {
          label: "Email us",
          href: "mailto:hello@example.com",
          variant: "secondary",
        },
      },
    ],
  };
}

function comingSoonTemplate(businessName?: string): EditorDocument {
  const id = blockIdFactory("coming-soon");
  const name = fallbackName(businessName);
  return {
    version: 1,
    root: { title: businessName?.trim() || "Coming soon" },
    blocks: [
      {
        id: id(),
        type: "Text",
        props: {
          heading: `${name} is coming soon`,
          body: "We're putting the finishing touches on something great. Check back soon.",
          level: "h1",
        },
      },
      {
        id: id(),
        type: "Button",
        props: {
          label: "Get in touch",
          href: "mailto:hello@example.com",
          variant: "primary",
        },
      },
      {
        id: id(),
        type: "Text",
        props: {
          heading: "Find us",
          body: "123 Main Street, Your City — update this with your address.",
          level: "h2",
        },
      },
    ],
  };
}

// Build the starter document for a template. `businessName` (the new site's
// name) is interpolated into the hero heading where it reads naturally.
export function buildTemplateDocument(
  templateId: TemplateId,
  businessName?: string,
): EditorDocument {
  switch (templateId) {
    case "local-service":
      return localServiceTemplate(businessName);
    case "coming-soon":
      return comingSoonTemplate(businessName);
    case "blank":
    default:
      return blankTemplate();
  }
}
