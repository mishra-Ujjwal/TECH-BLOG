"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * A minimal consent gate, and a deliberately honest one.
 *
 * This is NOT a certified consent management platform. Google requires a
 * certified CMP for advertising traffic from the UK and the EEA, and only a
 * certified CMP can pass TCF consent signals to Google's ad stack. Treat this
 * component as a placeholder that keeps ad scripts off the page until a visitor
 * agrees, and replace it with your chosen CMP before you turn ads on.
 *
 * What it does do correctly: no advertising script is injected until consent is
 * stored, and the choice can be changed again from the footer.
 */

const KEY = "consent.ads.v1";
type Choice = "granted" | "denied";

function read(): Choice | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function write(choice: Choice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* private mode, blocked storage: fall back to per-visit behaviour */
  }
}

export function useAdConsent(): Choice | null {
  const [choice, setChoice] = useState<Choice | null>(null);
  useEffect(() => {
    setChoice(read());
    const onChange = () => setChoice(read());
    window.addEventListener("consentchange", onChange);
    return () => window.removeEventListener("consentchange", onChange);
  }, []);
  return choice;
}

export function ConsentBanner({ privacyPath = "/privacy-policy" }: { privacyPath?: string }) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setChoice(read());
    setReady(true);
  }, []);

  function decide(next: Choice) {
    write(next);
    setChoice(next);
    window.dispatchEvent(new Event("consentchange"));
  }

  if (!ready || choice !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie choices"
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-accent bg-paper"
    >
      <div className="mx-auto flex w-full max-w-[72rem] flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-small text-ink-2">
          We would like to set advertising cookies. Nothing is set unless you agree. Read our{" "}
          <Link href={privacyPath} className="link">
            privacy policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide("denied")}
            className="rounded-lg border border-rule-strong px-3.5 py-1.5 text-small font-medium hover:bg-paper-2"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => decide("granted")}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-small font-medium text-paper hover:bg-accent-2"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConsentResetLink({ className = "underline" }: { className?: string }) {
  function reset() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("consentchange"));
    window.location.reload();
  }
  return (
    <button type="button" onClick={reset} className={className}>
      Cookie choices
    </button>
  );
}

/**
 * Loads the AdSense script, but only when ads are switched on in site.json AND
 * the visitor has consented. Renders nothing otherwise.
 */
export function AdScript({ publisherId, enabled }: { publisherId: string; enabled: boolean }) {
  const consent = useAdConsent();
  const [injected, setInjected] = useState(false);

  useEffect(() => {
    if (!enabled || !publisherId || consent !== "granted" || injected) return;
    if (document.querySelector("script[data-adsense]")) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
    s.crossOrigin = "anonymous";
    s.setAttribute("data-adsense", "1");
    document.head.appendChild(s);
    setInjected(true);
  }, [enabled, publisherId, consent, injected]);

  return null;
}

/**
 * One ad slot. Reserves its height so an ad appearing does not shift the page,
 * which is what hurts Cumulative Layout Shift on review pages.
 */
export function AdSlot({
  publisherId,
  slotId,
  enabled,
  minHeight = 280,
  label = "Advertisement",
}: {
  publisherId: string;
  slotId: string;
  enabled: boolean;
  minHeight?: number;
  label?: string;
}) {
  const consent = useAdConsent();
  const show = Boolean(enabled && publisherId && slotId && consent === "granted");

  useEffect(() => {
    if (!show) return;
    // An inline <script> inserted by React on the client never runs, so push here.
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
    } catch {
      /* blocked by an ad blocker, nothing to do */
    }
  }, [show]);

  if (!show) return null;
  return (
    <div className="my-8" style={{ minHeight }}>
      <p className="mb-1 text-center text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
        {label}
      </p>
      <ins
        className="adsbygoogle block"
        style={{ display: "block", minHeight }}
        data-ad-client={publisherId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
