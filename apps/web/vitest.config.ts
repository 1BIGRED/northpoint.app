import { defineConfig } from "vitest/config";

// Unit tests run in a Node environment — the suites here cover pure
// functions (the editor's document/config adapters), not DOM rendering, so
// no jsdom is needed. Add a jsdom project later if/when we test components.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
