import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container" style={{ padding: "120px 0", textAlign: "center" }}>
      <span className="eyebrow">404</span>
      <h1 className="display" style={{ fontSize: 48, margin: "10px 0" }}>Lost in the apothecary</h1>
      <p className="muted">We couldn't find that page.</p>
      <Link href="/" className="btn btn--primary" style={{ marginTop: 20 }}>
        Take me home
      </Link>
    </main>
  );
}
