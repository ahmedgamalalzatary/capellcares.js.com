import { notFound } from "next/navigation";
import { getDict, languages, type Language } from "@capella/shared";
import { AuthForm } from "@/components/auth/auth-forms";

export default async function SignupPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!languages.includes(lang as Language)) notFound();
  const dict = getDict(lang as Language);
  return (
    <main className="container">
      <AuthForm mode="signup" lang={lang as Language} dict={dict} />
    </main>
  );
}
