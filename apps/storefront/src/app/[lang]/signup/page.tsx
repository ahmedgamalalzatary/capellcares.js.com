import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-forms";
import { resolveStorefrontPageContext } from "@/lib/storefront-page-context";

export default async function SignupPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);
  return (
    <main className="container">
      {/* See the login page: useSearchParams needs a Suspense boundary. */}
      <Suspense>
        <AuthForm mode="signup" lang={lang} dict={dict} />
      </Suspense>
    </main>
  );
}
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata();
