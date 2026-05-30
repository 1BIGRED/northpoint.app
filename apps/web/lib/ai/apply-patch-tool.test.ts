import { describe, expect, it, vi } from "vitest";

import type { EditorDocument } from "@/lib/editor";

import {
  runApplyPatch,
  type ApplyPatchDeps,
  type ApplyPatchResultInfo,
} from "./apply-patch-tool";

// Exercises the tool's handler in isolation: a real applyAIEdit runs, but the
// document store + persistence are injected mocks. No AI SDK, no network.

function baseDoc(): EditorDocument {
  return {
    version: 1,
    blocks: [
      { id: "blk-1", type: "Text", props: { heading: "Old", body: "x", level: "h2" } },
    ],
    root: { title: "Home" },
  };
}

// A test harness: a mutable working document plus spies, matching the closure
// the chat route builds around streamText.
function harness(initial: EditorDocument = baseDoc()) {
  let doc = initial;
  const results: ApplyPatchResultInfo[] = [];
  const persist = vi.fn(async (next: EditorDocument) => {
    void next;
  });
  const deps: ApplyPatchDeps = {
    getDocument: () => doc,
    setDocument: (next) => {
      doc = next;
    },
    persist,
    onResult: (info) => results.push(info),
  };
  return { deps, persist, results, current: () => doc };
}

describe("runApplyPatch", () => {
  it("applies a valid patch, persists it, and advances the working document", async () => {
    const h = harness();
    const out = await runApplyPatch(h.deps, {
      patch: [{ op: "replace", path: "/blocks/0/props/heading", value: "New" }],
      summary: "Changed the heading",
    });

    expect(out.ok).toBe(true);
    expect(out.blockCount).toBe(1);
    // Persisted exactly once, with the UPDATED document.
    expect(h.persist).toHaveBeenCalledTimes(1);
    expect(h.persist.mock.calls[0][0].blocks[0].props.heading).toBe("New");
    // Working document advanced for any subsequent patch in the same turn.
    expect(h.current().blocks[0].props.heading).toBe("New");
    expect(h.results.at(-1)).toMatchObject({ ok: true, summary: "Changed the heading" });
  });

  it("rejects a forbidden-path patch without persisting", async () => {
    const h = harness();
    const out = await runApplyPatch(h.deps, {
      patch: [{ op: "replace", path: "/blocks/0/id", value: "hacked" }],
      summary: "Try to change id",
    });

    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/forbidden path/i);
    expect(h.persist).not.toHaveBeenCalled();
    // Working document is unchanged.
    expect(h.current().blocks[0].id).toBe("blk-1");
    expect(h.results.at(-1)).toMatchObject({ ok: false });
  });

  it("rejects a patch that produces an invalid document without persisting", async () => {
    const h = harness();
    const out = await runApplyPatch(h.deps, {
      patch: [
        { op: "replace", path: "/blocks/0", value: { id: "blk-1", type: "Nope" } },
      ],
      summary: "Break the block",
    });

    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/invalid document/i);
    expect(h.persist).not.toHaveBeenCalled();
  });

  it("chains: a second patch sees the first patch's result", async () => {
    const h = harness();
    await runApplyPatch(h.deps, {
      patch: [
        {
          op: "add",
          path: "/blocks/-",
          value: { id: "blk-2", type: "Button", props: { label: "Go", href: "/x" } },
        },
      ],
      summary: "Add a button",
    });
    const out = await runApplyPatch(h.deps, {
      patch: [{ op: "replace", path: "/blocks/1/props/label", value: "Book now" }],
      summary: "Rename the button",
    });

    expect(out.ok).toBe(true);
    expect(h.current().blocks).toHaveLength(2);
    expect(h.current().blocks[1].props.label).toBe("Book now");
    expect(h.persist).toHaveBeenCalledTimes(2);
  });
});
