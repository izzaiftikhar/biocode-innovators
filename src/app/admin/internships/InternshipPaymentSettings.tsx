"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

type SettingsForm = {
  payment_method: string;
  account_title: string;
  account_number: string;
  certificate_fee: string;
  instructions: string;
};

const emptySettings: SettingsForm = {
  payment_method: "",
  account_title: "",
  account_number: "",
  certificate_fee: "",
  instructions: "",
};

export default function InternshipPaymentSettings() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [form, setForm] = useState<SettingsForm>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data, error: fetchError } = await supabase
        .from("internship_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message);
      } else if (data) {
        setForm({
          payment_method: data.payment_method ?? "",
          account_title: data.account_title ?? "",
          account_number: data.account_number ?? "",
          certificate_fee:
            data.certificate_fee === null || data.certificate_fee === undefined
              ? ""
              : String(data.certificate_fee),
          instructions: data.instructions ?? "",
        });
      }

      setLoading(false);
    }

    void load();
  }, [supabase]);

  function updateField<K extends keyof SettingsForm>(
    field: K,
    value: SettingsForm[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    let fee: number | null = null;

    if (form.certificate_fee.trim() !== "") {
      fee = Number(form.certificate_fee);

      if (!Number.isFinite(fee) || fee < 0) {
        setError("Certificate fee must be a number, 0 or more.");
        return;
      }
    }

    setSaving(true);

    const { data, error: saveError } = await supabase
      .from("internship_settings")
      .upsert(
        {
          id: 1,
          payment_method: form.payment_method.trim() || null,
          account_title: form.account_title.trim() || null,
          account_number: form.account_number.trim() || null,
          certificate_fee: fee,
          instructions: form.instructions.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("id");

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    if (!data?.length) {
      setError("Settings were not saved. Check your database permissions.");
      return;
    }

    setMessage("Payment details saved.");
  }

  return (
    <section
      aria-label="Internship certificate payment details"
      className="mt-14 rounded-2xl border border-current/10 p-5 md:p-8"
    >
      <h2 className="text-xl font-semibold">Certificate payment details</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Interns see these details only after all their tasks are approved. They
        pay, then upload a screenshot for you to check.
      </p>

      {message && (
        <p
          role="status"
          className="mt-5 rounded-lg border border-green-600/30 p-3 text-sm"
        >
          {message}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-5 break-words rounded-lg border border-red-500/40 p-3 text-sm"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading payment details...</p>
      ) : (
        <form onSubmit={handleSave} className="mt-6 space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Payment method
              <input
                value={form.payment_method}
                onChange={(e) => updateField("payment_method", e.target.value)}
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
                placeholder="Mobile wallet or bank transfer"
              />
            </label>

            <label className="block text-sm font-medium">
              Account title
              <input
                value={form.account_title}
                onChange={(e) => updateField("account_title", e.target.value)}
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
                placeholder="Name on the account"
              />
            </label>

            <label className="block text-sm font-medium">
              Account / contact number
              <input
                value={form.account_number}
                onChange={(e) => updateField("account_number", e.target.value)}
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
                placeholder="Number interns send payment to"
              />
            </label>

            <label className="block text-sm font-medium">
              Certificate fee
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.certificate_fee}
                onChange={(e) => updateField("certificate_fee", e.target.value)}
                className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
                placeholder="Amount"
              />
            </label>
          </div>

          <label className="block text-sm font-medium">
            Instructions for interns
            <textarea
              rows={4}
              value={form.instructions}
              onChange={(e) => updateField("instructions", e.target.value)}
              className="mt-2 w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 font-normal"
              placeholder="e.g. Send the exact amount, then upload a clear screenshot showing the transaction ID."
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save payment details"}
          </button>
        </form>
      )}
    </section>
  );
}
