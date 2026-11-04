/**
 * Pieces of the studio that run in the browser as well as on the server. Nothing
 * here may touch the filesystem.
 */

/**
 * Drop what an empty form field leaves behind ("" and empty optional objects), so an
 * untouched optional field reads as absent rather than as an invalid empty string.
 */
export function clean(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(clean).filter((v) => v !== undefined);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const c = clean(v);
      if (c !== undefined) out[k] = c;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  if (typeof value === "string" && value.trim() === "") return undefined;
  if (typeof value === "number" && Number.isNaN(value)) return undefined;
  return value;
}

export function slugify(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/, "");
}

/** Zod's wording is for developers; say it the way a writer would. */
export function plain(message: string): string {
  if (/received undefined/.test(message)) return "Required";
  const short = message.match(/expected string to have >=(\d+) characters/);
  if (short) return `Too short: at least ${short[1]} characters`;
  const long = message.match(/expected string to have <=(\d+) characters/);
  if (long) return `Too long: at most ${long[1]} characters`;
  const few = message.match(/expected array to have >=(\d+) items/);
  if (few) return `Add at least ${few[1]}`;
  if (/Invalid string: must match pattern/.test(message)) return "Wrong format";
  return message;
}
