import { notFound } from "next/navigation";

import { SpikeEditor } from "./editor";

export const dynamic = "force-dynamic";

export default function SpikeEditorPage() {
  // Gate per TASK 1 spec: not available in production.
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Editor spike — Group E1
          </h1>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Puck POC
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag blocks from the sidebar onto the canvas. State persists in
          localStorage. Not visible in production.
        </p>
      </header>
      <SpikeEditor />
    </main>
  );
}
