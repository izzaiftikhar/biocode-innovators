"use client";

export default function AskAssistantButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("biocode:open-chat"))}
      className="inline-flex items-center justify-center rounded-md border border-white/30 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-accent hover:text-accent"
    >
      Ask the assistant
    </button>
  );
}
