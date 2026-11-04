"use client";

import { useActionState } from "react";
import { login, type LoginState } from "../actions";

const inputCls =
  "w-full rounded-lg border border-rule-strong bg-paper px-3 py-2 text-base text-ink";

export function LoginForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="mt-8 space-y-4">
      <div>
        <label htmlFor="username" className="text-small font-medium">
          Login id
        </label>
        <input id="username" name="username" autoComplete="username" required disabled={disabled} className={`${inputCls} mt-1.5`} />
      </div>
      <div>
        <label htmlFor="password" className="text-small font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={disabled}
          className={`${inputCls} mt-1.5`}
        />
      </div>
      {state.error && (
        <p role="alert" className="text-small text-caution">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || disabled}
        className="w-full rounded-lg bg-accent px-3.5 py-2.5 text-small font-medium text-paper hover:bg-accent-2 disabled:opacity-50"
      >
        {pending ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
