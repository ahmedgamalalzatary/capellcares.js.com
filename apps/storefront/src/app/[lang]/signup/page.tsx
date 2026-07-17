import { redirect } from "next/navigation";

/** Signup lives inside the login page as an inline mode. */
export default async function SignupPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  redirect(`/${lang}/login?mode=signup`);
}
