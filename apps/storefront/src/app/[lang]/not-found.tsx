import Link from "next/link";
import { headers } from "next/headers";
import { getDict } from "@capella/shared";

export default async function NotFound() {
  const lang = (await headers()).get("x-capella-locale") === "en" ? "en" : "ar";
  const dict = getDict(lang);
  return (
    <main className="container not-found">
      <h1 className="display my-[10px] text-[48px]">{dict.notFound.title}</h1>
      <p className="muted">{dict.notFound.description}</p>
      <Link href={`/${lang}/shop`} className="btn btn--primary mt-5">
        {dict.notFound.cta}
      </Link>
    </main>
  );
}
