import Link from "next/link";
import { LEVEL_ORDER, type Check, type Level, type Risk } from "@/lib/adsense-check";

/**
 * Pieces shared by the AdSense readiness page and the editor's writing check.
 * Colours follow the dashboard's site-readiness list: moss for done, umber for
 * anything to look at.
 */

const MARK: Record<Level, { sign: string; cls: string; sr: string }> = {
  fail: { sign: "!", cls: "bg-caution text-paper", sr: "Must fix" },
  warn: { sign: "!", cls: "bg-caution-wash text-caution", sr: "Should fix" },
  manual: { sign: "?", cls: "bg-paper-2 text-ink-2", sr: "Check by hand" },
  pass: { sign: "✓", cls: "bg-measured-wash text-measured", sr: "Done" },
};

const RISK: Record<Risk, { label: string; cls: string }> = {
  high: { label: "High risk", cls: "bg-caution text-paper" },
  medium: { label: "Medium risk", cls: "bg-caution-wash text-caution" },
  low: { label: "Low risk", cls: "bg-measured-wash text-measured" },
};

export function RiskBadge({ risk }: { risk: Risk }) {
  return (
    <span className={`inline-block shrink-0 rounded-full px-2.5 py-0.5 text-micro font-semibold ${RISK[risk].cls}`}>
      {RISK[risk].label}
    </span>
  );
}

export function sortChecks(checks: Check[]): Check[] {
  return [...checks].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

/**
 * A list of checks, worst first. `onJump` (editor only) makes field paths clickable;
 * `href` links to the studio page that fixes it.
 */
export function CheckList({
  checks,
  onJump,
  hidePassed = false,
  small = false,
}: {
  checks: Check[];
  onJump?: (path: string) => void;
  hidePassed?: boolean;
  small?: boolean;
}) {
  const shown = sortChecks(checks).filter((c) => !hidePassed || c.level !== "pass");
  if (shown.length === 0) return null;
  const text = small ? "text-micro" : "text-small";
  return (
    <ul className={`space-y-2.5 ${text}`}>
      {shown.map((c) => (
        <li key={c.id} className="flex items-start gap-2.5">
          <span
            aria-hidden="true"
            className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-micro font-bold ${MARK[c.level].cls}`}
          >
            {MARK[c.level].sign}
          </span>
          <span className="min-w-0">
            <span className="sr-only">{MARK[c.level].sr}: </span>
            {onJump && c.path ? (
              <button type="button" className="text-left font-medium hover:underline" onClick={() => onJump(c.path!)}>
                {c.label}
              </button>
            ) : (
              <span className="font-medium">{c.label}</span>
            )}
            {c.detail && <span className="block break-words text-micro text-ink-2">{c.detail}</span>}
            {c.level !== "pass" && c.fix && <span className="block text-micro text-ink-3">{c.fix}</span>}
            {c.level !== "pass" && c.href && (
              <Link href={c.href} className="link text-micro">
                Fix this
              </Link>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
