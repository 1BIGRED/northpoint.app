import type { ComponentDefinition } from "../types";

type TextProps = {
  heading: string;
  body: string;
  level: "h1" | "h2" | "h3";
};

export const textBlock: ComponentDefinition<TextProps> = {
  type: "Text",
  label: "Text",
  defaultProps: {
    heading: "Section heading",
    body: "A short paragraph below the heading. Click to edit.",
    level: "h2",
  },
  fields: {
    heading: { kind: "text", label: "Heading" },
    body: { kind: "textarea", label: "Body" },
    level: {
      kind: "select",
      label: "Heading level",
      options: [
        { label: "H1", value: "h1" },
        { label: "H2", value: "h2" },
        { label: "H3", value: "h3" },
      ],
    },
  },
  render: ({ heading, body, level }) => {
    // Defensive: fall back to a valid heading level. A missing/invalid `level`
    // would make HeadingTag undefined and crash React ("Element type is
    // invalid"). normalizeDocument should fill this, but the renderer must not
    // assume complete props — one bad block must never blank the page.
    const safeLevel = level === "h1" || level === "h3" ? level : "h2";
    const headingClass =
      safeLevel === "h1"
        ? "text-4xl font-semibold tracking-tight"
        : safeLevel === "h2"
          ? "text-2xl font-semibold tracking-tight"
          : "text-xl font-semibold tracking-tight";
    const HeadingTag = safeLevel;
    return (
      <div className="space-y-2 py-4">
        <HeadingTag className={headingClass}>{heading}</HeadingTag>
        <p className="text-muted-foreground">{body}</p>
      </div>
    );
  },
};
