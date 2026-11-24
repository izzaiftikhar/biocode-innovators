"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import {
  DEFAULT_LETTER_LAYOUT,
  LAYOUT_LIMITS,
  LETTER_FIELDS,
  normalizeLayout,
  type FieldBox,
  type FieldKey,
  type LetterLayout,
} from "@/lib/internships/letterLayout";

type Kind = "certificate" | "appreciation";

const COLUMN = {
  certificate: "certificate_layout",
  appreciation: "appreciation_layout",
} as const;

const TITLE = {
  certificate: "Certificate text positions",
  appreciation: "Appreciation letter text positions",
} as const;

const SAMPLE_KEY = "biocode-internship-test-names";
const DEFAULT_SAMPLES = [
  "Sample Student Name",
  "Ali Khan",
  "Muhammad Abdullah bin Abdul Rahman Khan",
];
const MAX_NAME = 100;
const MAX_SAMPLES = 30;

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, [min, max]: readonly [number, number]) =>
  Math.min(max, Math.max(min, n));

const cleanName = (value: string) => value.replace(/\s+/g, " ").trim();
const validName = (value: string) =>
  value.length >= 2 && value.length <= MAX_NAME && !/[<>]/.test(value);

export default function LayoutEditor({ internshipId }: { internshipId: string }) {
  const [samples, setSamples] = useState<string[]>(DEFAULT_SAMPLES);
  const [active, setActive] = useState(DEFAULT_SAMPLES[0]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAMPLE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;

      if (Array.isArray(parsed)) {
        const list = parsed
          .filter((item): item is string => typeof item === "string")
          .map(cleanName)
          .filter(validName)
          .slice(0, MAX_SAMPLES);

        if (list.length) {
          setSamples(list);
          setActive(list[0]);
        }
      }
    } catch {
      // Use the built-in names.
    }
  }, []);

  function saveSamples(next: string[]) {
    setSamples(next);

    try {
      window.localStorage.setItem(SAMPLE_KEY, JSON.stringify(next));
    } catch {
      // The list still works for this visit.
    }
  }

  return (
    <section aria-label="Template text positions" className="space-y-8">
      <SampleNames
        samples={samples}
        active={active}
        onUse={setActive}
        onChange={saveSamples}
      />
      <KindEditor
        internshipId={internshipId}
        kind="certificate"
        sampleName={active}
      />
      <KindEditor
        internshipId={internshipId}
        kind="appreciation"
        sampleName={active}
      />
    </section>
  );
}

function SampleNames({
  samples,
  active,
  onUse,
  onChange,
}: {
  samples: string[];
  active: string;
  onUse: (name: string) => void;
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState("");

  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

  function check(value: string, ignore: number | null) {
    if (!validName(value)) {
      setError("Enter a name of 2 to 100 characters, without < or >.");
      return false;
    }

    if (samples.some((item, i) => i !== ignore && same(item, value))) {
      setError("That name is already in the list.");
      return false;
    }

    setError("");
    return true;
  }

  function tryName() {
    const name = cleanName(input);

    if (!validName(name)) {
      setError("Enter a name of 2 to 100 characters, without < or >.");
      return;
    }

    setError("");
    onUse(name);
  }

  function add() {
    const name = cleanName(input);

    if (samples.length >= MAX_SAMPLES) {
      setError(`You can keep up to ${MAX_SAMPLES} names.`);
      return;
    }

    if (!check(name, null)) return;

    onChange([...samples, name]);
    onUse(name);
    setInput("");
  }

  function startEdit(index: number) {
    setEditing(index);
    setInput(samples[index]);
    setError("");
  }

  function saveEdit() {
    if (editing === null) return;

    const name = cleanName(input);
    if (!check(name, editing)) return;

    const wasActive = samples[editing] === active;
    onChange(samples.map((item, i) => (i === editing ? name : item)));
    if (wasActive) onUse(name);

    setEditing(null);
    setInput("");
  }

  function cancelEdit() {
    setEditing(null);
    setInput("");
    setError("");
  }

  function remove(index: number) {
    if (samples.length <= 1) {
      setError("Keep at least one name in the list.");
      return;
    }

    const removed = samples[index];
    const next = samples.filter((_, i) => i !== index);

    onChange(next);
    if (removed === active) onUse(next[0]);

    if (editing === index) cancelEdit();
    else setError("");
  }

  const button =
    "rounded-lg border border-current/20 px-3 py-2 text-sm hover:bg-current/5";

  return (
    <div className="rounded-lg border border-current/10 p-4">
      <h4 className="text-base font-semibold">Test names</h4>
      <p className="mt-1 text-sm text-muted">
        Try different names to see how they sit on the certificate and the
        appreciation letter. The selected name is used by both Preview buttons
        below. This list is saved in this browser.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-3 break-words rounded-lg border border-red-500/40 p-3 text-sm"
        >
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={input}
          maxLength={MAX_NAME}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a student name"
          aria-label="Test name"
          className="min-w-0 flex-1 rounded-lg border border-current/20 bg-transparent px-3 py-2 text-sm"
        />

        {editing === null ? (
          <>
            <button type="button" onClick={tryName} className={button}>
              Try it
            </button>
            <button
              type="button"
              onClick={add}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Add to list
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={saveEdit}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Save name
            </button>
            <button type="button" onClick={cancelEdit} className={button}>
              Cancel
            </button>
          </>
        )}
      </div>

      <p className="mt-3 text-sm">
        Previewing with: <strong className="break-words">{active}</strong>
      </p>

      <ul className="mt-2 space-y-2">
        {samples.map((name, index) => (
          <li
            key={`${name}-${index}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-current/10 p-2"
          >
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <input
                type="radio"
                name="test-name"
                checked={name === active}
                onChange={() => onUse(name)}
              />
              <span className="min-w-0 break-words">{name}</span>
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => startEdit(index)}
                className="rounded-lg border border-current/20 px-3 py-1 text-xs hover:bg-current/5"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-600 hover:bg-red-500/5"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KindEditor({
  internshipId,
  kind,
  sampleName,
}: {
  internshipId: string;
  kind: Kind;
  sampleName: string;
}) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [layout, setLayout] = useState<LetterLayout>(DEFAULT_LETTER_LAYOUT);
  const [selected, setSelected] = useState<FieldKey>("name");
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState<"preview" | "save" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const urlRef = useRef("");
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("internships")
        .select(COLUMN[kind])
        .eq("id", internshipId)
        .maybeSingle();

      const row = data as Record<string, unknown> | null;
      setLayout(normalizeLayout(row?.[COLUMN[kind]]));
    }

    void load();
  }, [supabase, internshipId, kind]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  const preview = useCallback(
    async (next: LetterLayout) => {
      setError("");
      setBusy("preview");

      try {
        const response = await fetch("/api/admin/internships/letter-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            internshipId,
            kind,
            layout: next,
            name: sampleName,
          }),
        });

        if (!response.ok) {
          const result = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          setError(result?.error || "Could not create the preview.");
          return;
        }

        const blob = await response.blob();
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(blob);
        setPreviewUrl(urlRef.current);
      } catch {
        setError("Could not create the preview.");
      } finally {
        setBusy(null);
      }
    },
    [internshipId, kind, sampleName]
  );

  // When a different test name is picked, redraw an open preview with it.
  useEffect(() => {
    if (urlRef.current) void preview(layoutRef.current);
  }, [preview]);

  function updateField(key: FieldKey, change: Partial<FieldBox>) {
    setLayout((current) => ({
      ...current,
      fields: { ...current.fields, [key]: { ...current.fields[key], ...change } },
    }));
  }

  function handleImageClick(event: React.MouseEvent<HTMLImageElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp(round1(((event.clientX - rect.left) / rect.width) * 100), LAYOUT_LIMITS.x);
    const y = clamp(round1(((event.clientY - rect.top) / rect.height) * 100), LAYOUT_LIMITS.y);

    const next: LetterLayout = {
      ...layout,
      fields: { ...layout.fields, [selected]: { ...layout.fields[selected], x, y } },
    };

    setLayout(next);
    void preview(next);
  }

  function centerOnPage() {
    const next: LetterLayout = {
      ...layout,
      fields: {
        ...layout.fields,
        [selected]: { ...layout.fields[selected], x: 50, center: true },
      },
    };

    setLayout(next);
    void preview(next);
  }

  async function save() {
    setMessage("");
    setError("");
    setBusy("save");

    const clean = normalizeLayout(layout);

    const { data, error: saveError } = await supabase
      .from("internships")
      .update({ [COLUMN[kind]]: clean })
      .eq("id", internshipId)
      .select("id");

    setBusy(null);

    if (saveError || !data?.length) {
      setError(saveError?.message ?? "Could not save. Check your database permissions.");
      return;
    }

    setLayout(clean);
    setMessage("Positions saved.");
  }

  const box = layout.fields[selected];

  return (
    <div className="rounded-lg border border-current/10 p-4">
      <h4 className="text-base font-semibold">{TITLE[kind]}</h4>
      <p className="mt-1 text-sm text-muted">
        Press Preview, then click the image where the name should go. With
        centering on, your click sets the middle of the name. Save when it
        looks right.
      </p>

      {message && (
        <p role="status" className="mt-3 rounded-lg border border-green-600/30 p-3 text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 break-words rounded-lg border border-red-500/40 p-3 text-sm">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {LETTER_FIELDS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelected(key)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              selected === key
                ? "border-current bg-current/10 font-semibold"
                : "border-current/20 hover:bg-current/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <label className="block text-xs font-medium">
          Left (%)
          <input
            type="number"
            step={0.1}
            min={LAYOUT_LIMITS.x[0]}
            max={LAYOUT_LIMITS.x[1]}
            value={box.x}
            onChange={(e) => updateField(selected, { x: clamp(Number(e.target.value) || 0, LAYOUT_LIMITS.x) })}
            className="mt-1 w-full rounded-lg border border-current/20 bg-transparent px-2 py-2 font-normal"
          />
        </label>
        <label className="block text-xs font-medium">
          Top (%)
          <input
            type="number"
            step={0.1}
            min={LAYOUT_LIMITS.y[0]}
            max={LAYOUT_LIMITS.y[1]}
            value={box.y}
            onChange={(e) => updateField(selected, { y: clamp(Number(e.target.value) || 0, LAYOUT_LIMITS.y) })}
            className="mt-1 w-full rounded-lg border border-current/20 bg-transparent px-2 py-2 font-normal"
          />
        </label>
        <label className="block text-xs font-medium">
          Size (% of width)
          <input
            type="number"
            step={0.1}
            min={LAYOUT_LIMITS.size[0]}
            max={LAYOUT_LIMITS.size[1]}
            value={box.size}
            onChange={(e) => updateField(selected, { size: clamp(Number(e.target.value) || 1, LAYOUT_LIMITS.size) })}
            className="mt-1 w-full rounded-lg border border-current/20 bg-transparent px-2 py-2 font-normal"
          />
        </label>
        <label className="block text-xs font-medium">
          Text colour
          <input
            type="color"
            value={layout.color}
            onChange={(e) => setLayout((c) => ({ ...c, color: e.target.value }))}
            className="mt-1 block h-10 w-full rounded-lg border border-current/20 bg-transparent"
          />
        </label>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!box.hidden}
          onChange={(e) => updateField(selected, { hidden: !e.target.checked })}
          className="size-4"
        />
        Show this field on the document
      </label>

      <label className="mt-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={box.center === true}
          onChange={(e) => updateField(selected, { center: e.target.checked })}
          className="size-4"
        />
        Center the text on this position (Left % becomes the middle point)
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void preview(layout)}
          disabled={busy !== null}
          className="rounded-lg border border-current/20 px-4 py-2 text-sm hover:bg-current/5 disabled:opacity-50"
        >
          {busy === "preview" ? "Rendering..." : "Preview"}
        </button>
        <button
          type="button"
          onClick={centerOnPage}
          disabled={busy !== null}
          className="rounded-lg border border-current/20 px-4 py-2 text-sm hover:bg-current/5 disabled:opacity-50"
        >
          Center on page
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy !== null}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy === "save" ? "Saving..." : "Save positions"}
        </button>
        <button
          type="button"
          onClick={() => setLayout(DEFAULT_LETTER_LAYOUT)}
          disabled={busy !== null}
          className="rounded-lg border border-current/20 px-4 py-2 text-sm hover:bg-current/5 disabled:opacity-50"
        >
          Reset to default
        </button>
      </div>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Template preview. Click to place the selected field."
          onClick={handleImageClick}
          className="mt-4 w-full max-w-3xl cursor-crosshair rounded-lg border border-current/10"
        />
      )}
    </div>
  );
}
