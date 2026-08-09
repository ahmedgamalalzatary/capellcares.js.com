import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadInstagramEmbedScript, resolveAdviceVideo } from "@/lib/advice-video";

beforeEach(() => {
  document.body.innerHTML = "";
  delete (window as Window & { instgrm?: { Embeds?: { process?: () => void } } }).instgrm;
});

describe("resolveAdviceVideo", () => {
  it("builds YouTube popup player and thumbnail URLs", () => {
    expect(resolveAdviceVideo("https://www.youtube.com/watch?v=capella")).toEqual({
      provider: "youtube",
      permalinkUrl: "https://www.youtube.com/watch?v=capella",
      popupUrl: expect.stringContaining("https://www.youtube.com/embed/capella?"),
      embedUrl: expect.stringContaining("https://www.youtube.com/embed/capella?"),
      thumbnailUrl: "https://i.ytimg.com/vi/capella/sddefault.jpg"
    });
  });

  // The popup is a chrome-free reel; a video sitting inside a gallery instead
  // needs a scrubber and volume, so the two players differ on controls.
  it("keeps player controls on the in-page embed but not the popup", () => {
    const resolved = resolveAdviceVideo("https://www.youtube.com/watch?v=capella");

    expect(resolved).toMatchObject({
      provider: "youtube",
      embedUrl: expect.stringContaining("controls=1"),
      popupUrl: expect.stringContaining("controls=0")
    });
  });

  it("normalizes Instagram reel URLs into official permalinks", () => {
    expect(resolveAdviceVideo("https://www.instagram.com/reels/DZfXbijzAD6/")).toEqual({
      provider: "instagram",
      permalinkUrl: "https://www.instagram.com/reels/DZfXbijzAD6/"
    });
  });

  it("preserves the original Instagram media type in the permalink", () => {
    expect(resolveAdviceVideo("https://www.instagram.com/p/ABC123/")).toEqual({
      provider: "instagram",
      permalinkUrl: "https://www.instagram.com/p/ABC123/"
    });

    expect(resolveAdviceVideo("https://www.instagram.com/tv/TV123/")).toEqual({
      provider: "instagram",
      permalinkUrl: "https://www.instagram.com/tv/TV123/"
    });
  });

  it("returns null for unsupported URLs", () => {
    expect(resolveAdviceVideo("https://example.com/video.mp4")).toBeNull();
    expect(resolveAdviceVideo("not-a-url")).toBeNull();
  });
});

describe("loadInstagramEmbedScript", () => {
  it("appends the Instagram embed script once", () => {
    loadInstagramEmbedScript();
    loadInstagramEmbedScript();

    const scripts = document.querySelectorAll('script[data-instgrm-embed="true"]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toHaveAttribute("src", "https://www.instagram.com/embed.js");
  });

  it("processes embeds when the script already exists", () => {
    document.body.innerHTML = '<script data-instgrm-embed="true" src="https://www.instagram.com/embed.js"></script>';
    const process = vi.fn();
    (window as Window & { instgrm?: { Embeds?: { process?: () => void } } }).instgrm = {
      Embeds: { process }
    };

    loadInstagramEmbedScript();

    expect(process).toHaveBeenCalledTimes(1);
  });
});
