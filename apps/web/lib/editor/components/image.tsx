import type { ComponentDefinition } from "../types";

type ImageProps = {
  src: string;
  alt: string;
};

export const imageBlock: ComponentDefinition<ImageProps> = {
  type: "Image",
  label: "Image",
  defaultProps: {
    src: "https://placehold.co/1200x600",
    alt: "Placeholder image",
  },
  fields: {
    src: { kind: "url", label: "Image URL" },
    alt: { kind: "text", label: "Alt text" },
  },
  render: ({ src, alt }) => (
    <div className="py-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="w-full rounded-md border" />
    </div>
  ),
};
