"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type PinLockProps = {
  nextPath: string;
};

type LockStatus = "idle" | "checking" | "error";

const PIN_LENGTH = 4;
const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "blank", "0", "backspace"];

export function PinLock({ nextPath }: PinLockProps) {
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<LockStatus>("idle");

  const submitPin = useCallback(
    async (candidate: string) => {
      if (candidate.length !== PIN_LENGTH) return;

      setStatus("checking");

      try {
        const response = await fetch("/api/site-lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: candidate })
        });

        if (!response.ok) throw new Error("Invalid PIN");

        window.location.replace(nextPath);
      } catch {
        setPin("");
        setStatus("error");
      }
    },
    [nextPath]
  );

  const appendDigit = useCallback(
    (digit: string) => {
      if (status === "checking") return;

      setStatus("idle");
      setPin((current) => {
        const nextValue = `${current}${digit}`.slice(0, PIN_LENGTH);
        if (nextValue.length === PIN_LENGTH) {
          void submitPin(nextValue);
        }

        return nextValue;
      });
    },
    [status, submitPin]
  );

  const removeDigit = useCallback(() => {
    if (status === "checking") return;

    setStatus("idle");
    setPin((current) => current.slice(0, -1));
  }, [status]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        appendDigit(event.key);
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        removeDigit();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [appendDigit, removeDigit]);

  const isChecking = status === "checking";

  return (
    <main className="min-h-[100svh] bg-canvas text-ink">
      <div className="mx-auto flex min-h-[100svh] w-full max-w-[360px] flex-col items-center justify-center px-6 py-10">
        <Image
          src="/logo.png"
          alt="JobFuture"
          width={92}
          height={92}
          priority
          className="h-[92px] w-[92px] object-contain"
        />

        <div
          aria-label={`${pin.length} of ${PIN_LENGTH} PIN digits entered`}
          className="mt-14 flex h-6 items-center justify-center gap-4"
        >
          {Array.from({ length: PIN_LENGTH }).map((_, index) => (
            <span
              key={index}
              className={`h-3 w-3 rounded-full border transition-colors ${
                pin.length > index
                  ? "border-ink bg-ink"
                  : status === "error"
                    ? "border-accent bg-transparent"
                    : "border-ink-faint bg-transparent"
              }`}
            />
          ))}
        </div>

        <p
          aria-live="assertive"
          className="mt-5 h-5 text-center text-[13px] font-medium text-accent-ink"
        >
          {status === "error" ? "Virheellinen PIN." : ""}
        </p>

        <div className="mt-8 grid w-[252px] grid-cols-3 gap-5">
          {keypad.map((key) =>
            key === "blank" ? (
              <span key={key} className="h-16 w-16" />
            ) : (
              <button
                key={key}
                type="button"
                aria-label={key === "backspace" ? "Poista numero" : `Numero ${key}`}
                disabled={isChecking}
                onClick={() => (key === "backspace" ? removeDigit() : appendDigit(key))}
                className="flex h-16 w-16 items-center justify-center rounded-full border border-rule-muted bg-surface text-[24px] font-semibold tabular-nums text-ink shadow-[0_10px_24px_rgba(16,21,23,0.06)] transition hover:border-accent hover:bg-accent-mist active:scale-95 disabled:cursor-wait disabled:opacity-55"
              >
                {key === "backspace" ? (
                  <span aria-hidden className="text-[24px] leading-none">
                    &larr;
                  </span>
                ) : (
                  key
                )}
              </button>
            )
          )}
        </div>
      </div>
    </main>
  );
}
