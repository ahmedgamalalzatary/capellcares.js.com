import { getDict, languages, type Language } from "@capella/shared";
import { notFound } from "next/navigation";

export async function resolveStorefrontLang<T extends { lang: string }>(params: Promise<T>) {
  const { lang } = await params;
  if (!languages.includes(lang as Language)) {
    notFound();
  }

  return lang as Language;
}

export async function resolveStorefrontPageContext(params: Promise<{ lang: string }>) {
  const lang = await resolveStorefrontLang(params);

  return {
    lang,
    dict: getDict(lang)
  };
}
