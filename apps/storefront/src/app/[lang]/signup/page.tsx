import { AuthForm } from "@/components/auth/auth-forms";
import { resolveStorefrontPageContext } from "@/lib/storefront-page-context";

export default async function SignupPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);
  return (
    <main className="container">
      <AuthForm mode="signup" lang={lang} dict={dict} />
    </main>
  );
}
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata();
