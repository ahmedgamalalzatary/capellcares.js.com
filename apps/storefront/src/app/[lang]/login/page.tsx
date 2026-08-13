import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-forms";
import { resolveStorefrontPageContext } from "@/lib/storefront-page-context";

export default async function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);
  return (
    <main className="container">
      {/* The form reads the `next` search param to know where to return the
          customer, and useSearchParams must sit under a Suspense boundary. */}
      <Suspense>
        <AuthForm mode="login" lang={lang} dict={dict} />
      </Suspense>
    </main>
  );
}
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata();
