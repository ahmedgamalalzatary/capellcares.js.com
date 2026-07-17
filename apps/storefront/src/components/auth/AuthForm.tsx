"use client";

import { useState, type FormEvent } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { login, signup } from "@/lib/auth";

const inputClass =
  "h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm text-brand-dark outline-none transition focus:border-brand-dark";

/**
 * Login form with an inline signup mode (one page, toggled in place). On
 * success the access token and user snapshot are stored client-side (the
 * refresh token cookie is set by the API) and the user is sent back to the shop.
 */
export function AuthForm({ initialMode = "login" }: { initialMode?: "login" | "signup" }) {
  const { lang, dict } = useLocale();
  const t = dict.auth;
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signup({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      } else {
        await login({ email: form.email.trim(), password: form.password });
      }
      window.location.assign(`/${lang}/products`);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Request failed");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-5 py-16">
      <h1 className="text-2xl font-extrabold uppercase tracking-wide text-brand-dark">
        {mode === "signup" ? t.signupTitle : t.loginTitle}
      </h1>

      {mode === "signup" && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-gray-600">{t.name}</span>
          <input required value={form.name} onChange={set("name")} className={inputClass} autoComplete="name" />
        </label>
      )}
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-gray-600">{t.email}</span>
        <input required type="email" dir="ltr" value={form.email} onChange={set("email")} className={inputClass} autoComplete="email" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-gray-600">{t.password}</span>
        <input
          required
          type="password"
          dir="ltr"
          minLength={8}
          value={form.password}
          onChange={set("password")}
          className={inputClass}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
      </label>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-brand-red">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full cursor-pointer rounded-full bg-brand-dark py-4 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-black disabled:opacity-50"
      >
        {submitting ? t.submitting : mode === "signup" ? t.signup : t.login}
      </button>

      <p className="text-center text-sm text-gray-500">
        {mode === "signup" ? t.haveAccount : t.noAccount}{" "}
        <button
          type="button"
          onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(null); }}
          className="cursor-pointer font-bold text-brand-dark underline"
        >
          {mode === "signup" ? t.login : t.signup}
        </button>
      </p>
    </form>
  );
}
