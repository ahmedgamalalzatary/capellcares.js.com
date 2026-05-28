import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

const REVALIDATE_SECRET = process.env.STOREFRONT_REVALIDATE_SECRET?.trim() || "dev-revalidate-secret";

type RevalidatePayload = {
  entity?: string;
  slug?: string;
};

export async function POST(request: Request) {
  const secret = request.headers.get("x-revalidate-secret")?.trim();
  if (!secret || secret !== REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as RevalidatePayload;
  if (payload.entity !== "product" || !payload.slug?.trim()) {
    return NextResponse.json({ ok: false, reason: "invalid-payload" }, { status: 400 });
  }

  const slug = payload.slug.trim();
  for (const lang of ["ar", "en"] as const) {
    revalidatePath(`/${lang}/products/${slug}`);
    revalidatePath(`/${lang}/products`);
    revalidatePath(`/${lang}/shop`);
  }
  revalidatePath("/sitemap.xml");

  return NextResponse.json({ ok: true });
}
