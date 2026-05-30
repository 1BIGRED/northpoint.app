"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";

import { toast } from "@northpoint/ui/components/sonner";

type Props = {
  siteId: string;
  // When false, AI is not configured on the server (no ANTHROPIC_API_KEY).
  // The panel renders a friendly, non-blocking notice instead of a composer.
  aiEnabled: boolean;
  // Called after the AI successfully applies one or more edits, so the parent
  // can pull the updated document back into the editor canvas.
  onAppliedEdit: () => void;
};

// Loose accessors over the AI SDK's part union — enough to render text and
// fold tool calls without dragging the full generic types through the UI.
type AnyPart = {
  type: string;
  text?: string;
  state?: string;
  toolCallId?: string;
  input?: { summary?: string };
  output?: { ok?: boolean; error?: string };
  errorText?: string;
};

function isToolPart(part: AnyPart): boolean {
  return part.type.startsWith("tool-");
}

export function ChatPanel({ siteId, aiEnabled, onAppliedEdit }: Props) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/sites/${siteId}/chat`,
    }),
  });

  // Fire onAppliedEdit + a toast exactly once per successful apply_patch.
  const processed = useRef<Set<string>>(new Set());
  useEffect(() => {
    let applied = false;
    for (const message of messages as UIMessage[]) {
      for (const part of message.parts as unknown as AnyPart[]) {
        if (!isToolPart(part) || part.state !== "output-available") continue;
        const id = part.toolCallId ?? `${message.id}:${part.type}`;
        if (processed.current.has(id)) continue;
        processed.current.add(id);
        if (part.output?.ok) {
          applied = true;
          toast(part.input?.summary ?? "{{PRODUCT_NAME}} updated your page");
        }
      }
    }
    if (applied) onAppliedEdit();
  }, [messages, onAppliedEdit]);

  const busy = status === "submitted" || status === "streaming";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text });
  }

  return (
    <aside className="flex h-full w-[360px] flex-col border-l bg-white">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Ask</h2>
        <span className="text-xs text-muted-foreground">AI editor</span>
      </header>

      {!aiEnabled ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-sm text-muted-foreground">
            AI editing needs{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              ANTHROPIC_API_KEY
            </code>{" "}
            in your <code className="text-xs">.env.local</code> — see the
            README. Manual editing still works.
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tell me what to change — e.g. “change my Saturday hours to 9–3”
                or “add a heading that says Welcome”.
              </p>
            ) : (
              (messages as UIMessage[]).map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
            {busy ? (
              <p className="text-xs text-muted-foreground">Sending…</p>
            ) : null}
            {error ? (
              <p className="text-xs text-red-700">
                Something went wrong. {error.message}
              </p>
            ) : null}
          </div>

          <form onSubmit={onSubmit} className="border-t p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) onSubmit(e);
                }}
                rows={2}
                placeholder="Ask for a change…"
                disabled={busy}
                className="flex-1 resize-none rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={busy || input.trim().length === 0}
                className="rounded-md bg-black px-3 py-2 text-xs font-medium text-white hover:bg-black/85 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </>
      )}
    </aside>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const parts = message.parts as unknown as AnyPart[];

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-lg bg-black px-3 py-2 text-sm text-white"
            : "max-w-[85%] space-y-1 text-sm text-foreground"
        }
      >
        {parts.map((part, i) => {
          if (part.type === "text") {
            return <p key={i} className="whitespace-pre-wrap">{part.text}</p>;
          }
          if (isToolPart(part)) {
            return <ToolChip key={i} part={part} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}

// Tool calls are compact and folded — a one-line chip showing the intent and
// outcome, not raw JSON.
function ToolChip({ part }: { part: AnyPart }) {
  const done = part.state === "output-available";
  const failed = part.state === "output-error" || part.output?.ok === false;
  const label =
    part.input?.summary ??
    (failed ? "Edit failed" : done ? "Applied an edit" : "Editing…");

  return (
    <div
      className={
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs " +
        (failed
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-muted bg-muted/40 text-muted-foreground")
      }
    >
      <span aria-hidden>{failed ? "⚠" : done ? "✓" : "…"}</span>
      <span>{label}</span>
    </div>
  );
}
