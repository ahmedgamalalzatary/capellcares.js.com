import { z } from "zod";

const isYouTubeUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const hostname = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (hostname === "youtu.be") return Boolean(segments[0]);
  if (hostname !== "youtube.com" && !hostname.endsWith(".youtube.com")) return false;

  if (url.pathname === "/watch") return Boolean(url.searchParams.get("v"));
  return (segments[0] === "shorts" || segments[0] === "embed") && Boolean(segments[1]);
};

export const nullableYouTubeUrlSchema = z
  .string()
  .max(1024)
  .refine(isYouTubeUrl, { message: "Invalid YouTube URL" })
  .nullable();
