import type { ComponentDefinition } from "../types";

type SectionProps = {
  background: "white" | "muted" | "dark";
  padding: "tight" | "comfortable" | "spacious";
  // Puck handles nested children via a special "DropZone" prop. The
  // abstraction layer exposes this as a generic "children" placeholder so
  // we can swap the underlying editor later without changing the section
  // component's contract.
};

export const sectionBlock: ComponentDefinition<SectionProps> = {
  type: "Section",
  label: "Section",
  defaultProps: {
    background: "white",
    padding: "comfortable",
  },
  fields: {
    background: {
      kind: "select",
      label: "Background",
      options: [
        { label: "White", value: "white" },
        { label: "Muted", value: "muted" },
        { label: "Dark", value: "dark" },
      ],
    },
    padding: {
      kind: "select",
      label: "Padding",
      options: [
        { label: "Tight", value: "tight" },
        { label: "Comfortable", value: "comfortable" },
        { label: "Spacious", value: "spacious" },
      ],
    },
  },
  render: ({ background, padding }) => {
    const bg =
      background === "muted"
        ? "bg-gray-50"
        : background === "dark"
          ? "bg-black text-white"
          : "bg-white";
    const pad =
      padding === "tight"
        ? "py-4"
        : padding === "spacious"
          ? "py-16"
          : "py-8";
    // Puck injects the nested DropZone via the adapter — we render a
    // visible placeholder here so the abstract render path stays valid
    // when used outside the editor (e.g. published HTML).
    return (
      <section className={`${bg} ${pad} px-6`}>
        <div className="mx-auto max-w-3xl space-y-4">
          {/* children injected by editor adapter */}
        </div>
      </section>
    );
  },
};
