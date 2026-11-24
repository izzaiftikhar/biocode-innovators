"use client";
import { useState } from "react";
import Wave from "@/components/Wave";

export default function ContactForm({ defaultTopic }: { defaultTopic: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setState("sending");
    const data = Object.fromEntries(new FormData(form));
    const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    setState(res.ok ? "sent" : "error");
    if (res.ok) form.reset();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-5">
      <div><label htmlFor="topic" className="mb-1 block text-sm font-semibold">Topic</label><input id="topic" name="topic" defaultValue={defaultTopic} placeholder="e.g. Research application" className="field" /></div>
      <div><label htmlFor="name" className="mb-1 block text-sm font-semibold">Name</label><input id="name" name="name" required className="field" /></div>
      <div><label htmlFor="email" className="mb-1 block text-sm font-semibold">Your email</label><input id="email" name="email" type="email" required className="field" /></div>
      <div><label htmlFor="message" className="mb-1 block text-sm font-semibold">Message</label><textarea id="message" name="message" rows={5} required className="field" /></div>
      <button className="btn" disabled={state === "sending"}>{state === "sending" ? <span className="inline-flex items-center gap-2"><Wave size={18} label="Sending" className="!text-white" /> Sending…</span> : "Send message"}</button>
      <p role="status" className="text-sm">
        {state === "sent" && "Message sent. We will reply by email."}
        {state === "error" && "The message was not sent. Check your details and try again."}
      </p>
    </form>
  );
}
