import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * One admin, credentials from the environment:
 *
 *   ADMIN_USERNAME          your login id
 *   ADMIN_PASSWORD          at least 12 characters
 *   ADMIN_SESSION_SECRET    optional; signs the session cookie. Defaults to a key
 *                           derived from the password, so changing the password
 *                           signs everyone out.
 *
 * The session is a signed, httpOnly cookie holding the username and an expiry. There
 * is no user table and nothing to leak but the cookie itself.
 */

export const SESSION_COOKIE = "studio_session";
const SESSION_DAYS = 7;
const MIN_PASSWORD = 12;

type Config = { username: string; password: string; secret: string };

/** null when the environment is not set up, so the login page can say so. */
export function adminConfig(): Config | null {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!username || password.length < MIN_PASSWORD) return null;
  const secret =
    process.env.ADMIN_SESSION_SECRET ||
    createHash("sha256").update(`studio-session:${username}:${password}`).digest("hex");
  return { username, password, secret };
}

export function configProblem(): string | null {
  if (!process.env.ADMIN_USERNAME?.trim()) return "ADMIN_USERNAME is not set";
  if ((process.env.ADMIN_PASSWORD ?? "").length < MIN_PASSWORD) {
    return `ADMIN_PASSWORD is not set or is shorter than ${MIN_PASSWORD} characters`;
  }
  return null;
}

/** Compare without leaking the length or the position of the first difference. */
function sameSecret(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(cfg: Config): { token: string; maxAge: number } {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const payload = Buffer.from(
    JSON.stringify({ u: cfg.username, exp: Math.floor(Date.now() / 1000) + maxAge }),
  ).toString("base64url");
  return { token: `${payload}.${sign(payload, cfg.secret)}`, maxAge };
}

function verifyToken(token: string | undefined, cfg: Config): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !sameSecret(sig, sign(payload, cfg.secret))) return false;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return u === cfg.username && typeof exp === "number" && exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export async function isAdmin(): Promise<boolean> {
  const cfg = adminConfig();
  if (!cfg) return false;
  const jar = await cookies();
  return verifyToken(jar.get(SESSION_COOKIE)?.value, cfg);
}

/** Call at the top of every studio page. Sends anyone else to the login page. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/studio/login");
}

/** For route handlers: a 401 response when not signed in, otherwise null. */
export async function adminGuard(): Promise<Response | null> {
  return (await isAdmin()) ? null : Response.json({ error: "sign in first" }, { status: 401 });
}

/* ------------------------------ login attempts ------------------------------ */

/**
 * Five wrong tries per address per 15 minutes. In memory, so it resets on restart;
 * enough to stop a script guessing, which is the point.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRIES = 5;
const attempts = new Map<string, { count: number; until: number }>();

async function clientKey(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export async function checkCredentials(
  username: string,
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const cfg = adminConfig();
  if (!cfg) return { ok: false, message: "Sign-in is not set up. See the note below." };

  const key = await clientKey();
  const now = Date.now();
  const rec = attempts.get(key);
  if (rec && rec.until > now && rec.count >= MAX_TRIES) {
    const mins = Math.ceil((rec.until - now) / 60000);
    return { ok: false, message: `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }

  // Check both, always, so a wrong username takes as long as a wrong password.
  const userOk = sameSecret(username.trim(), cfg.username);
  const passOk = sameSecret(password, cfg.password);
  if (userOk && passOk) {
    attempts.delete(key);
    return { ok: true };
  }

  const fresh = !rec || rec.until <= now;
  attempts.set(key, { count: fresh ? 1 : rec.count + 1, until: fresh ? now + WINDOW_MS : rec.until });
  return { ok: false, message: "That login id and password do not match." };
}
