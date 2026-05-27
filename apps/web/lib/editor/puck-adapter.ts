// The single place in the codebase allowed to import from @measured/puck.
// Everything else imports from `lib/editor` (index.ts) which re-exports
// only generic types + the adapter's outputs.

import type { Config, Data, Field as PuckField } from "@measured/puck";

import type { ComponentDefinition, ComponentRegistry, EditorDocument, Field } from "./types";

// Translate our field-schema language into Puck's field shape. Keeps
// component definitions free of Puck-specific types.
function toPuckField(field: Field): PuckField {
  switch (field.kind) {
    case "text":
      return { type: "text", label: field.label };
    case "textarea":
      return { type: "textarea", label: field.label };
    case "url":
      // Puck has no first-class URL field; "text" is the practical match.
      return { type: "text", label: field.label };
    case "select":
      return {
        type: "select",
        label: field.label,
        options: field.options.map((o) => ({ label: o.label, value: o.value })),
      };
    case "number":
      return {
        type: "number",
        label: field.label,
        min: field.min,
        max: field.max,
      };
    case "array": {
      const arrayFields: Record<string, PuckField> = {};
      for (const [key, sub] of Object.entries(field.itemFields)) {
        arrayFields[key] = toPuckField(sub);
      }
      return {
        type: "array",
        label: field.label,
        arrayFields,
      };
    }
  }
}

function toPuckComponent(def: ComponentDefinition) {
  const fields: Record<string, PuckField> = {};
  for (const [key, value] of Object.entries(def.fields)) {
    if (value) fields[key] = toPuckField(value);
  }

  return {
    label: def.label,
    fields,
    defaultProps: def.defaultProps,
    render: (props: Record<string, unknown>) =>
      def.render(props as Parameters<typeof def.render>[0]),
  };
}

export function buildPuckConfig(registry: ComponentRegistry): Config {
  const components: Record<string, ReturnType<typeof toPuckComponent>> = {};
  for (const def of Object.values(registry)) {
    components[def.type] = toPuckComponent(def);
  }
  return { components } as Config;
}

// Convert between our document shape and Puck's internal `Data` format.
// We keep the data shapes structurally compatible (both are { content:
// Block[], root: {} } with id+type+props), so these are mostly passthroughs.
export function toPuckData(doc: EditorDocument): Data {
  return {
    content: doc.blocks.map((b) => ({
      type: b.type,
      props: { ...b.props, id: b.id },
    })),
    root: { props: doc.root ?? {} },
  };
}

export function fromPuckData(data: Data): EditorDocument {
  return {
    version: 1,
    blocks: data.content.map((c) => {
      const { id: maybeId, ...rest } = (c.props ?? {}) as { id?: string } & Record<string, unknown>;
      return {
        id: maybeId ?? crypto.randomUUID(),
        type: c.type as string,
        props: rest,
      };
    }),
    root: (data.root?.props ?? {}) as Record<string, unknown>,
  };
}
