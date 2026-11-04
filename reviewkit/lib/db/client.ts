import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Two connections on purpose:
 *   sqlRead  - DATABASE_URL, meant to be a SELECT-only role (the site).
 *   sqlAdmin - DATABASE_URL_ADMIN, the owner role (migrations and imports only).
 *
 * Both are created lazily so that `next build` works with no database at all
 * when CONTENT_SOURCE=files.
 */

let read: NeonQueryFunction<false, false> | null = null;
let admin: NeonQueryFunction<false, false> | null = null;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function sqlRead(): NeonQueryFunction<false, false> {
  if (!read) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Set CONTENT_SOURCE=files to run without a database.",
      );
    }
    read = neon(url);
  }
  return read;
}

export function sqlAdmin(): NeonQueryFunction<false, false> {
  if (!admin) {
    const url = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL_ADMIN (or DATABASE_URL) is required for this command.");
    }
    admin = neon(url);
  }
  return admin;
}
