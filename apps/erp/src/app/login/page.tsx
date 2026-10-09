"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const { user, hydrated, login } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && user) router.replace("/dashboard");
  }, [hydrated, user, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const result = await login(email, password);
    setBusy(false);
    if (result.ok) router.replace("/dashboard");
    else setError(result.error);
  };

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-rail p-12 text-rail-text lg:flex">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="block size-10 shrink-0 rounded-full bg-[url('/brand/capella-logo.jpg')] bg-[length:auto_108%] bg-[position:2%_50%] shadow-[0_0_0_1px_oklch(1_0_0/0.08)]"
          />
          <span className="text-lg font-bold tracking-wide text-rail-strong">Capella</span>
        </div>
        <div className="grid gap-4">
          <h2 className="text-2xl font-bold text-rail-strong">أهلاً بعودتكِ إلى لوحة كابيلا.</h2>
          <p className="max-w-[38ch] leading-relaxed text-rail-muted">
            تحكّمي في الكتالوج، تابعي المخزون، وحدّثي العروض من مكان واحد. صُمّمت لإيقاع عملك اليومي.
          </p>
        </div>
        <p className="text-xs tracking-wide text-rail-muted">ج.م · عربي</p>
      </aside>

      <section className="grid place-items-center bg-canvas p-6">
        <form onSubmit={submit} className="w-full max-w-sm rounded-well bg-surface p-8 shadow-well">
          <h1 className="text-xl font-bold text-text-strong">تسجيل الدخول</h1>
          <p className="mt-1 text-sm text-text-muted">أدخلي بيانات حساب المسؤول لمتابعة العمل.</p>

          <div className="mt-6 grid gap-4">
            <Field label="البريد الإلكتروني" htmlFor="login-email">
              <Input
                id="login-email"
                type="email"
                dir="ltr"
                autoComplete="email"
                placeholder="admin@capella.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label="كلمة المرور" htmlFor="login-password">
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
              {busy ? "جارٍ التحقق…" : "تسجيل الدخول"}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
