"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Msg = { role: "user" | "assistant"; content: string; links?: { href: string; label: string }[] };

const GREETING: Msg = {
  role: "assistant",
  content: "Hi! I can answer questions about BioCode courses, enrolment, certificates, internships and research.",
  links: [{ href: "/faq", label: "Browse the FAQs" }],
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, open]);

  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("biocode:open-chat", openChat);
    return () => window.removeEventListener("biocode:open-chat", openChat);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const history = messages.filter((m) => m !== GREETING).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setMessages((m) => [...m, { role: "assistant", content: data.reply, links: data.links }]);
    } catch (error) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: error instanceof Error && error.message ? error.message : "Sorry, I could not answer that. Please try again or contact us.",
          links: [{ href: "/contact", label: "Contact us" }],
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <section
          aria-label="BioCode assistant"
          className="fixed inset-x-3 bottom-[4.5rem] z-50 flex max-h-[min(34rem,calc(100dvh-6rem))] flex-col overflow-hidden rounded-2xl border border-line bg-bg shadow-2xl sm:inset-x-auto sm:bottom-20 sm:right-5 sm:w-96"
        >
          <header className="flex items-center justify-between bg-secondary px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
                <img src="/images/chatbot-avatar.png" alt="" width={40} height={40} className="h-8 w-8 object-contain" />
              </span>
              <div>
                <p className="font-heading text-sm font-semibold">BioCode Assistant</p>
                <p className="flex items-center gap-1.5 text-xs text-white/70">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-400" /> Here to help
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-md px-2 py-1 text-xl leading-none hover:bg-white/10">×</button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex items-end justify-start gap-2"}>
                {m.role === "assistant" && (
                  <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-white">
                    <img src="/images/chatbot-avatar.png" alt="" width={28} height={28} className="h-6 w-6 object-contain" />
                  </span>
                )}
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "bg-primary text-white" : "bg-surface text-ink"}`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.links && m.links.length > 0 && (
                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {m.links.map((l) => (
                        <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="font-semibold text-primary underline underline-offset-2">{l.label}</Link>
                      ))}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {busy && <p className="text-sm text-muted" aria-live="polite">Thinking…</p>}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
            <label htmlFor="chat-input" className="sr-only">Your question</label>
            <input
              id="chat-input"
              ref={inputRef}
              className="field !py-2.5 text-sm"
              placeholder="Ask a question…"
              maxLength={500}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" className="btn !px-4 disabled:opacity-60" disabled={busy || !input.trim()}>Send</button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close chat" : "Open chat assistant"}
        className="group fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary/30 bg-white shadow-xl transition-transform duration-200 hover:scale-105 hover:border-primary focus-visible:scale-105 sm:bottom-5 sm:right-5 sm:h-16 sm:w-16"
      >
        {!open && (
          <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-primary/20 [animation-duration:2.5s]" />
        )}
        <img
          src="/images/chatbot-avatar.png"
          alt=""
          width={64}
          height={64}
          className="relative h-9 w-9 object-contain transition-transform duration-200 group-hover:-rotate-6 sm:h-12 sm:w-12"
        />
        {open && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-sm leading-none text-white sm:h-6 sm:w-6">×</span>
        )}
      </button>
    </>
  );
}
