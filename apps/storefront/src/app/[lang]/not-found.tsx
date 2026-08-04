import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container not-found">
      <span className="eyebrow">404</span>
      <h1 className="display my-[10px] text-[48px]">Lost in the apothecary</h1>
      <p className="muted">We couldn't find that page.</p>
      <Link href="/" className="btn btn--primary mt-5">
        Take me home
      </Link>
    </main>
  );
}
