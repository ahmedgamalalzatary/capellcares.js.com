import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { AuthForm } from "@/components/auth/AuthForm";

/** Customer login (`POST /api/v1/auth/login`), with signup as an inline mode (`?mode=signup`). */
export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return (
    <>
      <Header />
      <main className="min-h-[40vh] bg-gray-50">
        <div className="container">
          <AuthForm initialMode={mode === "signup" ? "signup" : "login"} />
        </div>
      </main>
      <Footer />
    </>
  );
}
