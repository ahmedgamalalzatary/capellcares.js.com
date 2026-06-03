import { AuthForm } from "@/components/auth/auth-forms";
import { resolveStorefrontPageContext } from "@/lib/storefront-page-context";

export default async function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);
  return (
    <main className="container">
      <AuthForm mode="login" lang={lang} dict={dict} />
    </main>
  );
}
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata();
