import type { ComponentDefinition } from "../types";

type ButtonProps = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

export const buttonBlock: ComponentDefinition<ButtonProps> = {
  type: "Button",
  label: "Button",
  defaultProps: {
    label: "Get started",
    href: "https://example.com",
    variant: "primary",
  },
  fields: {
    label: { kind: "text", label: "Label" },
    href: { kind: "url", label: "Link URL" },
    variant: {
      kind: "select",
      label: "Style",
      options: [
        { label: "Primary", value: "primary" },
        { label: "Secondary", value: "secondary" },
      ],
    },
  },
  render: ({ label, href, variant }) => {
    const styles =
      variant === "primary"
        ? "bg-black text-white hover:bg-black/85"
        : "bg-white text-black border border-black hover:bg-black/5";
    return (
      <div className="py-4">
        <a
          href={href}
          className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition ${styles}`}
        >
          {label}
        </a>
      </div>
    );
  },
};
