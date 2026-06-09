"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "ok" | "error";

// Keep the spinner on screen for a graceful minimum, so the experience
// always feels deliberate even when the API responds instantly.
const MIN_SENDING_MS = 1400;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const topics = [
  { value: "kuntotutkimus", label: "Sähköjärjestelmien kuntotutkimus" },
  { value: "kaapelitutkaus", label: "Kaapelitutkaus" },
  { value: "tarvikkeet", label: "LVI- tai sähkötarvikkeet" },
  { value: "lampopumppu", label: "Ilmalämpöpumppu tai jäähdytyslaite" },
  { value: "konsultointi", label: "Sähkö- tai telejärjestelmien konsultointi" },
  { value: "korjaus-asennus", label: "Korjaus- tai asennuspalvelu" },
  { value: "suunnittelu", label: "Pienimuotoinen suunnittelu" },
  { value: "muu", label: "Muu" }
];

const fieldClass =
  "block w-full border border-rule-muted bg-canvas px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:bg-surface focus:outline-none";

const labelClass = "block text-[11px] uppercase tracking-label text-accent-ink";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      topic: String(formData.get("topic") ?? "").trim(),
      message: String(formData.get("message") ?? "").trim(),
      callback: formData.get("callback") === "on"
    };

    if (!payload.name || !payload.message || (!payload.email && !payload.phone)) {
      setStatus("error");
      setError("Anna nimi, viesti ja vähintään sähköposti tai puhelin.");
      return;
    }

    setStatus("sending");
    setError(null);
    const startedAt = Date.now();

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(result?.error || "Lähetys epäonnistui.");
      }

      // Hold the spinner for a graceful minimum before the confirmation.
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_SENDING_MS) {
        await wait(MIN_SENDING_MS - elapsed);
      }

      setStatus("ok");
      form.reset();
    } catch (err) {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_SENDING_MS) {
        await wait(MIN_SENDING_MS - elapsed);
      }
      setStatus("error");
      setError(err instanceof Error ? err.message : "Tuntematon virhe.");
    }
  }

  if (status === "ok") {
    return (
      <div className="border border-accent-soft bg-accent-mist p-6 sm:p-8">
        <p className="text-[11px] uppercase tracking-label text-accent-ink">
          Vastaanotettu
        </p>
        <h3 className="mt-4 font-display text-[32px] leading-tight tracking-display text-ink">
          Kiitos yhteydenotosta.
        </h3>
        <p className="mt-4 max-w-[44ch] text-[15px] leading-[1.6] text-ink-muted">
          Olemme sinuun yhteydessä mahdollisimman pian, yleensä saman
          arkipäivän aikana.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="group mt-8 inline-flex items-center gap-3 border-b border-accent-ink py-1 text-[14px] font-semibold text-accent-ink transition hover:gap-4"
        >
          Lähetä uusi viesti
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </button>
      </div>
    );
  }

  return (
    <>
      {status === "sending" && <SendingOverlay />}
      <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
        <Field label="Nimi" required>
          <input
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Etunimi Sukunimi"
            className={fieldClass}
          />
        </Field>
        <Field label="Aihe">
          <select name="topic" defaultValue="" className={`${fieldClass} appearance-none`}>
            <option value="" className="text-ink-faint">
              Valitse aihe
            </option>
            {topics.map((topic) => (
              <option key={topic.value} value={topic.value}>
                {topic.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sähköposti">
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nimi@osoite.fi"
            className={fieldClass}
          />
        </Field>
        <Field label="Puhelin">
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="044 000 0000"
            className={fieldClass}
          />
        </Field>
      </div>

      <Field label="Viesti" required>
        <textarea
          name="message"
          required
          rows={5}
          placeholder="Kerro lyhyesti kohteesta ja aikataulusta."
          className={`${fieldClass} resize-none`}
        />
      </Field>

      <label className="flex items-center gap-3 text-[14px] text-ink-muted">
        <input
          name="callback"
          type="checkbox"
          className="h-4 w-4 border-rule accent-accent focus:ring-0"
        />
        Soittakaa minulle takaisin.
      </label>

      <p className="text-[12px] text-ink-faint">
        Anna vähintään sähköposti tai puhelin, jotta voimme vastata.
      </p>

      {status === "error" && error && (
        <p
          role="alert"
          className="border-l-2 border-accent bg-accent-mist px-4 py-3 text-[13px] text-ink"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-4 border-t border-rule-muted pt-8 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={status === "sending"}
          className="group inline-flex w-full items-center justify-center gap-3 border border-accent bg-accent px-8 py-4 text-[15px] font-semibold text-white shadow-[0_14px_30px_rgba(23,111,125,0.18)] transition hover:border-accent-ink hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {status === "sending" ? "Lähetetään." : "Lähetä viesti"}
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </button>
        <span className="text-[12px] text-ink-faint sm:max-w-[24ch] sm:text-right">
          Vastaamme yleensä saman arkipäivän aikana.
        </span>
      </div>
      </form>
    </>
  );
}

function SendingOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Lähetetään viestiä"
      className="animate-overlay-in fixed inset-0 z-[70] flex items-center justify-center bg-night/90 px-6 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-6">
        <span
          aria-hidden
          className="h-12 w-12 animate-spin rounded-full border-2 border-white/15 border-t-accent-soft"
        />
        <p className="text-[11px] uppercase tracking-label text-white/60">
          Lähetetään
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>
        {label}
        {required && <span aria-hidden className="ml-1 text-ink">*</span>}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
