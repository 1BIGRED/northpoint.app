import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Unit tests run in a Node environment — the suites here cover pure
// functions (the editor's document/config adapters, AI prompt + tool
// handlers), not DOM rendering, so no jsdom is needed. Add a jsdom project
// later if/when we test components.
export default defineConfig({
  resolve: {
    alias: {
      // Mirror the tsconfig `@/*` → `./*` path alias so tests can import the
      // same way the app does.
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
