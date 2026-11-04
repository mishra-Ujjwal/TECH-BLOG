"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  adminConfig,
  checkCredentials,
  createSessionToken,
  SESSION_COOKIE,
} from "@/lib/admin-auth";
import { studioEnabled } from "@/lib/studio";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!studioEnabled()) return { error: "The studio is switched off here." };
  const result = await checkCredentials(String(form.get("username") ?? ""), String(form.get("password") ?? ""));
  if (!result.ok) return { error: result.message };

  const cfg = adminConfig()!;
  const { token, maxAge } = createSessionToken(cfg);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
  redirect("/studio");
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/studio/login");
}
