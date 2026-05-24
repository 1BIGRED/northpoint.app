import { defineConfig } from "drizzle-kit";

// DATABASE_URL is loaded by `dotenv-cli` via the package's db:* scripts —
// see packages/db/package.json. The canonical .env.local lives at
// apps/web/.env.local; we read DATABASE_URL from there.
// `drizzle-kit generate` works offline (no DB connection); only `migrate`
// and `studio` require a real URL, and they'll surface their own error
// if it's missing.

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
