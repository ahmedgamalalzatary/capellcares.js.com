"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAdminAuth, ADMIN_CREDENTIALS_HINT } from "@/components/providers/admin-auth";
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
    <main style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr", background: "var(--bg)" }} className="login-grid">
      <section style={{ background: "var(--bg-sidebar)", color: "#f5f4f1", padding: "60px 48px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Icon.Logo size={36} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Capella</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", letterSpacing: 4 }}>ERP</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 12 }}>إدارة المتجر</div>
          <h2 style={{ fontSize: 38, margin: 0, lineHeight: 1.25 }}>أهلًا بعودتك<br /><span style={{ color: "var(--accent)" }}>إلى لوحة كابيلا.</span></h2>
          <p style={{ color: "rgba(255,255,255,0.7)", maxWidth: 38, marginTop: 16, lineHeight: 1.7 }}>
            تحكمي في الكتالوج، تابعي المخزون، وحدّثي العروض من مكان واحد.
          </p>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
          <span>v1 · 2026</span>
          <span>EGP</span>
          <span>عربي</span>
        </div>
      </section>

      <section style={{ display: "grid", placeItems: "center", padding: 24 }}>
        <form onSubmit={submit} className="card" style={{ width: "100%", maxWidth: 380, padding: 32 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>تسجيل الدخول</h1>
          <p className="muted" style={{ marginTop: 6, marginBottom: 24, fontSize: 13 }}>أدخلي بيانات حساب المسؤول لمتابعة العمل.</p>
          <div className="stack">
            <div className="field">
              <label>البريد الإلكتروني</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div className="field">
              <label>كلمة المرور</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            {error && <div className="field-error">{error}</div>}
            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
              {busy ? "جارٍ التحقق…" : "تسجيل الدخول"}
            </button>
          </div>
          <div style={{ marginTop: 18, padding: 12, background: "var(--bg-tint)", borderRadius: 6, fontSize: 12, color: "var(--ink-2)" }}>
            {ADMIN_CREDENTIALS_HINT
              ? <><strong>للتجربة:</strong> {ADMIN_CREDENTIALS_HINT.email} / {ADMIN_CREDENTIALS_HINT.password}</>
              : <>أضيفي <code>NEXT_PUBLIC_DEV_ADMIN_EMAIL</code> و <code>NEXT_PUBLIC_DEV_ADMIN_PASSWORD</code> إلى ملف <code>.env</code> ثم أعيدي تشغيل ERP.</>}
          </div>
        </form>
      </section>

      <style jsx global>{`
        @media (max-width: 880px) { .login-grid { grid-template-columns: 1fr !important; } .login-grid > section:first-child { display: none; } }
      `}</style>
    </main>
  );
}
