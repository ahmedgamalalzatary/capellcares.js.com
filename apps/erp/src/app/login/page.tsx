"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { Icon } from "@/components/ui/icons";

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const r = await login(email, password);
    setBusy(false);
    if (r.ok) router.replace("/dashboard");
    else setError(r.error);
  };

  return (
    <main className="login-grid">
      <section className="login-aside">
        <div className="login-aside__brand">
          <Icon.Logo size={36} />
          <div>
            <div className="login-aside__brand-name">Capella</div>
            <div className="login-aside__brand-tag">ERP</div>
          </div>
        </div>

        <div className="login-aside__lead">
          <span className="login-aside__eyebrow">إدارة المتجر</span>
          <h2>
            أهلاً بعودتكِ<br />
            <em>إلى لوحة كابيلا.</em>
          </h2>
          <p>
            تحكّمي في الكتالوج، تابعي المخزون، وحدّثي العروض من مكان واحد.
            صُممت لإيقاع عملك اليومي — لا أكثر، لا أقل.
          </p>
        </div>

        <div className="login-aside__meta">
          <span>v1 · 2026</span>
          <span>EGP</span>
          <span>عربي</span>
        </div>
      </section>

      <section className="login-form-wrap">
        <form onSubmit={submit} className="login-form">
          <span className="eyebrow" style={{ color: "var(--accent)" }}>كابيلا كيرز</span>
          <h1>تسجيل الدخول</h1>
          <p className="muted login-form__sub">أدخلي بيانات حساب المسؤول لمتابعة العمل.</p>

          <div className="stack" style={{ marginTop: 28, gap: 16 }}>
            <div className="field">
              <label>البريد الإلكتروني</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="admin@capella.com"
                required
              />
            </div>
            <div className="field">
              <label>كلمة المرور</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>
            {error && <div className="field-error">{error}</div>}
            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy} style={{ marginTop: 8 }}>
              {busy ? "جارٍ التحقق…" : "تسجيل الدخول"}
            </button>
          </div>

          <p className="login-form__foot">
            مشكلة في الدخول؟ <span style={{ color: "var(--accent)" }}>تواصلي مع الدعم</span>
          </p>
        </form>
      </section>

      <style jsx global>{`
        .login-grid {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          background: var(--canvas);
        }
        .login-aside {
          background:
            radial-gradient(140% 100% at 100% 0%, color-mix(in oklch, var(--accent) 22%, transparent), transparent 55%),
            var(--bg-sidebar);
          color: var(--canvas);
          padding: 64px 56px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }
        .login-aside::after {
          content: "";
          position: absolute;
          inset: auto -120px -200px auto;
          width: 460px; height: 460px;
          border-radius: 50%;
          background: radial-gradient(circle, color-mix(in oklch, var(--warm) 35%, transparent), transparent 70%);
          pointer-events: none;
        }
        .login-aside > * { position: relative; z-index: 1; }
        .login-aside__brand { display: flex; align-items: center; gap: 14px; }
        .login-aside__brand-name { font-size: 22px; font-weight: 800; letter-spacing: 0.005em; }
        .login-aside__brand-tag {
          font-size: 11px; letter-spacing: 0.32em;
          color: color-mix(in oklch, var(--canvas) 60%, transparent);
          margin-top: 2px;
        }
        .login-aside__eyebrow {
          display: inline-block; font-size: 12px; letter-spacing: 0.06em;
          color: color-mix(in oklch, var(--canvas) 60%, transparent);
          margin-bottom: 14px;
        }
        .login-aside__lead h2 {
          font-size: clamp(34px, 3.4vw, 46px); margin: 0; line-height: 1.25;
          font-weight: 700; letter-spacing: -0.005em;
        }
        .login-aside__lead h2 em {
          font-style: normal; color: var(--warm);
        }
        .login-aside__lead p {
          color: color-mix(in oklch, var(--canvas) 72%, transparent);
          max-width: 38ch; margin-top: 18px; line-height: 1.85; font-size: 14.5px;
        }
        .login-aside__meta {
          display: flex; gap: 24px; font-size: 12px;
          color: color-mix(in oklch, var(--canvas) 48%, transparent);
          letter-spacing: 0.04em;
        }

        .login-form-wrap {
          display: grid; place-items: center; padding: 32px;
        }
        .login-form {
          width: 100%; max-width: 420px;
          background: var(--surface);
          border: 1px solid var(--hairline);
          border-radius: var(--radius-lg);
          padding: 40px 36px;
          box-shadow: var(--shadow-1);
        }
        .login-form h1 {
          margin: 12px 0 0; font-size: 26px; font-weight: 800;
          letter-spacing: -0.005em; color: var(--ink);
        }
        .login-form__sub { margin-top: 6px; font-size: 13.5px; }
        .login-form__foot {
          margin: 24px 0 0; padding-top: 20px;
          border-top: 1px solid var(--hairline);
          text-align: center; font-size: 12.5px; color: var(--ink-3);
        }

        @media (max-width: 880px) {
          .login-grid { grid-template-columns: 1fr; }
          .login-aside { display: none; }
          .login-form-wrap { padding: 24px 16px; }
          .login-form { padding: 32px 24px; }
        }
      `}</style>
    </main>
  );
}
