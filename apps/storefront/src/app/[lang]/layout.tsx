import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { languages, type Language } from "@minikoshk/shared";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { AskMinikoshkButton } from "@/components/ask-minikoshk/AskMinikoshkButton";

export function generateStaticParams() {
  return languages.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!(languages as readonly string[]).includes(lang)) {
    notFound();
  }
  // The provider lives here (not the root layout) because this segment
  // re-renders when the locale changes during client-side navigation.
  return (
    <LocaleProvider lang={lang as Language}>
      {children}
      <AskMinikoshkButton lang={lang as Language} />
    </LocaleProvider>
  );
}
