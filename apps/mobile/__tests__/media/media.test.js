jest.mock("../../src/lib/api/base", () => ({ API_BASE: "https://api.example.com" }));
function media() { try { return require("../../src/lib/media"); } catch (e) { if (e.code === "MODULE_NOT_FOUND") return {}; throw e; } }
test("supported YouTube forms become a controlled inline player", () => {
  const { resolveVideo } = media(); expect(typeof resolveVideo).toBe("function");
  for (const url of ["https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://m.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ"]) {
    expect(resolveVideo(url)).toEqual({ kind: "embed", provider: "youtube",
      url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0",
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" });
  }
});
test("Instagram reels and posts stay inside an embed rather than opening a browser", () => {
  const { resolveVideo } = media(); expect(typeof resolveVideo).toBe("function");
  expect(resolveVideo("https://www.instagram.com/reel/Abc_123/")).toEqual({ kind: "embed", provider: "instagram",
    url: "https://www.instagram.com/reel/Abc_123/embed/", thumbnail: null });
});
test("lookalike domains, credentials, scripts and malformed IDs cannot become players", () => {
  const { resolveVideo } = media(); expect(typeof resolveVideo).toBe("function");
  for (const url of ["javascript:alert(1)", "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "https://notyoutube.com/watch?v=dQw4w9WgXcQ", "https://www.instagram.com.evil.test/p/abc/",
    "https://password@youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=%3Cscript%3E"]) {
    expect(resolveVideo(url)).toBeNull();
  }
});
test("gallery resolves bilingual media and appends only supported linked videos", () => {
  const { galleryItems } = media(); expect(typeof galleryItems).toBe("function");
  expect(galleryItems([{ type: "image", arUrl: null, enUrl: "/uploads/a.jpg" }, { type: "video", url: "/uploads/a.mp4" }], "ar", null,
    "https://youtu.be/dQw4w9WgXcQ")).toEqual([
    { kind: "image", url: "https://api.example.com/uploads/a.jpg" }, { kind: "file", url: "https://api.example.com/uploads/a.mp4" },
    { kind: "embed", provider: "youtube", url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0",
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" }
  ]);
});
test("development images may come from Metro on the configured API host without permitting other HTTP hosts", () => {
  const { galleryItems } = media();
  expect(galleryItems([], "en", "http://api.example.com:8081/brand.jpg")).toEqual([{ kind: "image", url: "http://api.example.com:8081/brand.jpg" }]);
  expect(galleryItems([], "en", "http://other.example.com/brand.jpg")).toEqual([]);
});
