import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@northpoint/ui"],
  // The editor-chat system prompt is loaded at runtime from /prompts (see
  // lib/ai/editor-chat-prompt.ts, CLAUDE.md §6). Trace it into the serverless
  // bundle so it's present on Vercel.
  outputFileTracingIncludes: {
    "/api/sites/**": ["./prompts/**"],
  },
};

export default nextConfig;
