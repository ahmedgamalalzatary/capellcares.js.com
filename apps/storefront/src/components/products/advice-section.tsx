import type { Advice, Language } from "@capella/shared";
import { pickLang } from "@capella/shared";

export function AdviceSection({ advices, lang, dict }: { advices: Advice[]; lang: Language; dict: any }) {
  if (advices.length === 0) return null;

  return (
    <section style={{ marginTop: 48, marginBottom: 80 }}>
      <header className="page-head" style={{ marginBottom: 20 }}>
        <span className="eyebrow">{dict.advices.title}</span>
        <h2>{dict.advices.title}</h2>
        <p className="muted">{dict.advices.description}</p>
      </header>
      <div className="grid grid--products">
        {advices.map((advice) => (
          <article key={advice.id} className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>{pickLang(advice.title, lang)}</h3>
              <p className="muted" style={{ marginTop: 8 }}>{pickLang(advice.description, lang)}</p>
            </div>
            {advice.imagePath ? <div className="tag">{advice.imagePath}</div> : null}
            {advice.videoUrl ? (
              <a href={advice.videoUrl} target="_blank" rel="noreferrer" className="btn btn--ghost" style={{ width: "fit-content" }}>
                {lang === "ar" ? "فتح الرابط" : "Open link"}
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
