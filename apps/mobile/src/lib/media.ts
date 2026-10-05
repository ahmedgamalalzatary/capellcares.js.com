import { resolveLocalizedEntityMediaUrl, type EntityMedia, type Language } from "@capella/shared";
import { resolveMediaUrl } from "./api/normalizers";
import { API_BASE } from "./api/base";
export type GalleryItem = { kind: "image" | "file"; url: string } |
  { kind: "embed"; provider: "youtube" | "instagram"; url: string; thumbnail: string | null };
function safeUrl(value: string): URL | null {
  try {
    const url = new URL(resolveMediaUrl(value));
    if (url.username || url.password) return null;
    if (url.protocol !== "https:" && !(__DEV__ && url.protocol === "http:" && url.hostname === new URL(API_BASE).hostname)) return null;
    return url;
  } catch { return null; }
}
export function resolveVideo(value: string): Exclude<GalleryItem, { kind: "image" | "file" }> | { kind: "file"; url: string } | null {
  const url = safeUrl(value); if (!url) return null;
  const host = url.hostname.toLowerCase(), parts = url.pathname.split("/").filter(Boolean);
  if (["youtu.be", "www.youtube.com", "youtube.com", "m.youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com"].includes(host)) {
    const id = host === "youtu.be" ? parts[0] : url.pathname === "/watch" ? url.searchParams.get("v") :
      ["shorts", "embed"].includes(parts[0]) ? parts[1] : null;
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return { kind: "embed", provider: "youtube", url: `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  }
  if (["instagram.com", "www.instagram.com"].includes(host)) {
    if (!["reel", "reels", "p", "tv"].includes(parts[0]) || !/^[A-Za-z0-9_-]{1,64}$/.test(parts[1] ?? "")) return null;
    return { kind: "embed", provider: "instagram", url: `https://www.instagram.com/${parts[0]}/${parts[1]}/embed/`, thumbnail: null };
  }
  if (/\.(mp4|webm|mov|m4v|m3u8)$/i.test(url.pathname) || (url.origin === new URL(API_BASE).origin && url.pathname.startsWith("/uploads/"))) {
    return { kind: "file", url: url.href };
  }
  return null;
}
export function galleryItems(media: EntityMedia[] | undefined, lang: Language, fallback?: string | null, linkedVideo?: string | null): GalleryItem[] {
  const items: GalleryItem[] = [];
  for (const item of media ?? []) {
    const raw = resolveLocalizedEntityMediaUrl(item, lang);
    if (item.type === "image") { const url = safeUrl(raw); if (url) items.push({ kind: "image", url: url.href }); }
    else { const video = resolveVideo(raw); if (video) items.push(video); }
  }
  if (!items.length && fallback) { const url = safeUrl(fallback); if (url) items.push({ kind: "image", url: url.href }); }
  const video = linkedVideo ? resolveVideo(linkedVideo) : null;
  if (video) items.push(video);
  return items;
}
