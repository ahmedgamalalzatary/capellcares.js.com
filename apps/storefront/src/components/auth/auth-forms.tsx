"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import type { Language } from "@capella/shared";
import styles from "./auth.module.css";

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim() || (mode === "signup" && !name.trim())) {
      setError(dict.checkout.required);
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await signup(name, email, password);
      router.push(`/${lang}`);
    } catch {
      setError(lang === "ar" ? "حدث خطأ، حاولي مرة أخرى." : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.card}>
      <h1 className="display" style={{ fontSize: 28, margin: 0 }}>
        {mode === "login" ? dict.auth.loginTitle : dict.auth.signupTitle}
      </h1>
      <p className="muted" style={{ marginTop: 8 }}>
        {mode === "login"
          ? (lang === "ar" ? "سعيدون بعودتك إلى كابيلا." : "Welcome back to Capella.")
          : (lang === "ar" ? "خطوة واحدة وتبدئي رحلتك معنا." : "One quick step before you shop.")}
      </p>

      <form onSubmit={submit} className={styles.form} noValidate>
        {mode === "signup" && (
          <div className="field">
            <label>{dict.auth.name}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
        )}
        <div className="field">
          <label>{dict.auth.email}</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="field">
          <label>{dict.auth.password}</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </div>
        {error && <div className="field-error">{error}</div>}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy} style={{ height: 48 }}>
          {busy ? dict.common.loading : (mode === "login" ? dict.auth.loginCta : dict.auth.signupCta)}
        </button>
      </form>

      <div className={styles.swap}>
        {mode === "login" ? (
          <>{dict.auth.noAccount} <Link href={`/${lang}/signup`}>{dict.auth.signupHere}</Link></>
        ) : (
          <>{dict.auth.haveAccount} <Link href={`/${lang}/login`}>{dict.auth.loginHere}</Link></>
        )}
      </div>
    </div>
  );
}
