"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import type { Language } from "@capella/shared";

type Mode = "login" | "signup";

export function AuthForm({ mode, lang, dict }: { mode: Mode; lang: Language; dict: any }) {
  const router = useRouter();
  const { login, signup, user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    router.push(`/${lang}`);
    return null;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim() || (mode === "signup" && !name.trim())) {
      setError(dict.checkout.required);
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
      router.push(`/${lang}`);
    } catch {
      setError(lang === "ar" ? "حدث خطأ، حاولي مرة أخرى." : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto my-16 max-w-[480px] rounded-(--radius-lg) border border-(--hairline) bg-(--surface) p-10 shadow-(--shadow-1) max-[640px]:my-10 max-[640px]:p-6">
      <span className="eyebrow !text-(--accent)">{lang === "ar" ? "كابيلا كير" : "Capella Care"}</span>
      <h1 className={`mt-3 m-0 leading-[1.1] ${lang === "ar"
        ? "text-[30px] font-bold font-(--font-ar) text-(--ink)"
        : "text-[34px] italic font-(--font-display) text-(--ink)"}`}>
        {mode === "login" ? dict.auth.loginTitle : dict.auth.signupTitle}
      </h1>
      <p className="mt-3 text-[14.5px] leading-[1.7] text-(--ink-2)">
        {mode === "login"
          ? lang === "ar"
            ? "أهلاً بعودتك. سجّلي الدخول لمتابعة رحلتك مع كابيلا."
            : "Welcome back. Sign in to pick up where you left off."
          : lang === "ar"
            ? "خطوة واحدة ويبدأ روتينك مع كابيلا."
            : "One quick step before your Capella routine begins."}
      </p>

      <form onSubmit={submit} className="mt-6 grid gap-4" noValidate>
        {mode === "signup" && (
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-(--ink-2)">{dict.auth.name}</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
        )}

        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-(--ink-2)">{dict.auth.email}</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-(--ink-2)">{dict.auth.password}</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>

        {error && <div className="text-sm text-(--danger)">{error}</div>}

        <button type="submit" className="btn btn--primary btn--block h-12" disabled={busy}>
          {busy ? dict.common.loading : mode === "login" ? dict.auth.loginCta : dict.auth.signupCta}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-(--ink-2)">
        {mode === "login" ? (
          <>
            {dict.auth.noAccount} <Link href={`/${lang}/signup`} className="font-semibold text-(--accent) underline-offset-4 hover:underline">{dict.auth.signupHere}</Link>
          </>
        ) : (
          <>
            {dict.auth.haveAccount} <Link href={`/${lang}/login`} className="font-semibold text-(--accent) underline-offset-4 hover:underline">{dict.auth.loginHere}</Link>
          </>
        )}
      </div>
    </div>
  );
}

