export async function apiFetch(path: string, lang: "ar" | "en", init?: RequestInit) {
  return fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-lang": lang,
      ...(init?.headers ?? {})
    }
  });
}
