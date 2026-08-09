export type AdviceVideoPresentation =
  | {
      provider: "youtube";
      permalinkUrl: string;
      /** Chrome-free player for the full-screen advice popup. */
      popupUrl: string;
      /** Player for a video sitting inline among other media, so it keeps controls. */
      embedUrl: string;
      thumbnailUrl: string;
    }
  | {
      provider: "instagram";
      permalinkUrl: string;
    };

type InstagramMediaPresentation = {
  mediaType: "reel" | "reels" | "p" | "tv";
  mediaId: string;
};

function parseUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function youtubeVideoId(url: URL): string | null {
  if (url.hostname === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }
  if (url.hostname.includes("youtube.com")) {
    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] === "shorts" || segments[0] === "embed") {
      return segments[1] ?? null;
    }
  }
  return null;
}

function instagramMedia(url: URL): InstagramMediaPresentation | null {
  if (!url.hostname.includes("instagram.com")) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] === "reel" || segments[0] === "reels" || segments[0] === "p" || segments[0] === "tv") {
    const mediaId = segments[1] ?? null;
    if (!mediaId) return null;
    return { mediaType: segments[0], mediaId };
  }
  return null;
}

export function resolveAdviceVideo(videoUrl: string): AdviceVideoPresentation | null {
  const url = parseUrl(videoUrl);
  if (!url) return null;

  const youtubeId = youtubeVideoId(url);
  if (youtubeId) {
    const popupParams = new URLSearchParams({
      rel: "0",
      playsinline: "1",
      controls: "0",
      modestbranding: "1"
    });
    const embedParams = new URLSearchParams({
      rel: "0",
      playsinline: "1",
      controls: "1",
      modestbranding: "1"
    });
    const base = `https://www.youtube.com/embed/${youtubeId}`;
    return {
      provider: "youtube",
      permalinkUrl: url.toString(),
      popupUrl: `${base}?${popupParams.toString()}`,
      embedUrl: `${base}?${embedParams.toString()}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${youtubeId}/sddefault.jpg`
    };
  }

  const instagram = instagramMedia(url);
  if (instagram) {
    const permalinkUrl = `https://www.instagram.com/${instagram.mediaType}/${instagram.mediaId}/`;
    return {
      provider: "instagram",
      permalinkUrl
    };
  }

  return null;
}

export function loadInstagramEmbedScript() {
  if (typeof document === "undefined") return;

  const existingScript = document.querySelector<HTMLScriptElement>('script[data-instgrm-embed="true"]');
  const processEmbeds = () => {
    const instagramWindow = window as Window & {
      instgrm?: { Embeds?: { process?: () => void } };
    };
    instagramWindow.instgrm?.Embeds?.process?.();
  };

  if (existingScript) {
    processEmbeds();
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.instagram.com/embed.js";
  script.dataset.instgrmEmbed = "true";
  script.onload = processEmbeds;
  document.body.appendChild(script);
}
