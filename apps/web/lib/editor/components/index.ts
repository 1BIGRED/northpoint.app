import type { ComponentDefinition, ComponentRegistry } from "../types";

import { buttonBlock } from "./button";
import { hoursBlock } from "./hours";
import { imageBlock } from "./image";
import { sectionBlock } from "./section";
import { textBlock } from "./text";

// Each block's props type is narrow (ButtonProps, HoursProps, …) but the
// registry stores them under the structural ComponentDefinition shape so
// the runtime adapter can walk them uniformly. Cast through the base
// definition is intentional and isolated to this file.
const definitions: ComponentDefinition[] = [
  textBlock,
  imageBlock,
  hoursBlock,
  buttonBlock,
  sectionBlock,
] as unknown as ComponentDefinition[];

export const registry: ComponentRegistry = Object.fromEntries(
  definitions.map((def) => [def.type, def]),
);
