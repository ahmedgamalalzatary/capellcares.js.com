import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { eq } from "drizzle-orm";

import { shopMediaSectionItems, shopMediaSections } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

import { parseUploadBody } from "../../src/modules/uploads/uploads.schemas.js";
import { deleteLocalUploadUrls, resolveUploadBodyLimitBytes, uploadBase64Media, UploadRejectedError } from "../../src/modules/uploads/uploads.service.js";

const WEBP_BYTES = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPimage-binary")]);
const MP4_BYTES = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisomvideo-binary")]);

test("parseUploadBody accepts valid image upload payload", () => {
  const parsed = parseUploadBody({
    fileName: "cream.png",
    mimeType: "image/png",
    contentBase64: Buffer.from("hello").toString("base64")
  });

  assert.equal(parsed.fileName, "cream.png");
  assert.equal(parsed.mimeType, "image/png");
});

test("parseUploadBody accepts valid video upload payload", () => {
  const parsed = parseUploadBody({
    fileName: "routine-demo.mp4",
    mimeType: "video/mp4",
    contentBase64: Buffer.from("video").toString("base64")
  });

  assert.equal(parsed.fileName, "routine-demo.mp4");
  assert.equal(parsed.mimeType, "video/mp4");
});

test("parseUploadBody rejects unsupported mime type", () => {
  assert.throws(
    () =>
      parseUploadBody({
        fileName: "malware.exe",
        mimeType: "application/x-msdownload",
        contentBase64: Buffer.from("bad").toString("base64")
      }),
    /mime|type/i
  );
});

test("uploadBase64Media saves image file and returns public URL + path", async () => {
  const uploadsDir = mkdtempSync(join(tmpdir(), "capella-upload-test-"));
  try {
    const result = await uploadBase64Media(
      {
        fileName: "body-lotion.webp",
        mimeType: "image/webp",
        contentBase64: WEBP_BYTES.toString("base64")
      },
      {
        uploadsDir,
        maxBytes: 4 * 1024 * 1024,
        publicBaseUrl: "https://example.com/uploads"
      }
    );

    assert.match(result.path, /^\/uploads\/.+\.webp$/);
    assert.match(result.url, /^https:\/\/example\.com\/uploads\/.+\.webp$/);

    const writtenBytes = readFileSync(join(uploadsDir, result.fileName));
    assert.deepEqual(writtenBytes, WEBP_BYTES);
  } finally {
    rmSync(uploadsDir, { recursive: true, force: true });
  }
});

test("uploadBase64Media saves video files without changing the extension", async () => {
  const uploadsDir = mkdtempSync(join(tmpdir(), "capella-upload-test-"));
  try {
    const result = await uploadBase64Media(
      {
        fileName: "routine-demo.mp4",
        mimeType: "video/mp4",
        contentBase64: MP4_BYTES.toString("base64")
      },
      {
        uploadsDir,
        maxBytes: 20 * 1024 * 1024,
        publicBaseUrl: "https://example.com/uploads"
      }
    );

    assert.match(result.path, /^\/uploads\/.+\.mp4$/);
    assert.match(result.url, /^https:\/\/example\.com\/uploads\/.+\.mp4$/);

    const writtenBytes = readFileSync(join(uploadsDir, result.fileName));
    assert.deepEqual(writtenBytes, MP4_BYTES);
  } finally {
    rmSync(uploadsDir, { recursive: true, force: true });
  }
});

test("uploadBase64Media rejects oversized payloads", async () => {
  const uploadsDir = mkdtempSync(join(tmpdir(), "capella-upload-test-"));
  try {
    const huge = Buffer.alloc(11).fill("a").toString("base64");
    await assert.rejects(
      () =>
        uploadBase64Media(
          {
            fileName: "too-big.png",
            mimeType: "image/png",
            contentBase64: huge
          },
          {
            uploadsDir,
            maxBytes: 10,
            publicBaseUrl: "https://example.com/uploads"
          }
        ),
      /maximum|size|bytes/i
    );
  } finally {
    rmSync(uploadsDir, { recursive: true, force: true });
  }
});

test("deleteLocalUploadUrls preserves files referenced by shop media", async () => {
  const fileName = `shop-media-reference-${Date.now()}.jpg`;
  const uploadPath = `/uploads/${fileName}`;
  const uploadsDir = join(process.cwd(), "uploads");
  const absolutePath = join(uploadsDir, fileName);
  mkdirSync(uploadsDir, { recursive: true });
  writeFileSync(absolutePath, "shop-media");

  const [section] = await db.insert(shopMediaSections).values({ status: "inactive" }).$returningId();
  try {
    await db.insert(shopMediaSectionItems).values({
      sectionId: section.id,
      arImagePath: null,
      arMobileImagePath: null,
      enImagePath: uploadPath,
      enMobileImagePath: null,
      targetType: "shop",
      targetId: null,
      sortOrder: 1
    });

    await deleteLocalUploadUrls([uploadPath]);

    assert.equal(existsSync(absolutePath), true);
  } finally {
    await db.delete(shopMediaSections).where(eq(shopMediaSections.id, section.id));
    rmSync(absolutePath, { force: true });
  }
});

test("uploadBase64Media rejects content that does not match the declared file type", async () => {
  const uploadsDir = mkdtempSync(join(tmpdir(), "capella-upload-test-"));
  try {
    await assert.rejects(
      () =>
        uploadBase64Media(
          {
            fileName: "fake.png",
            mimeType: "image/png",
            contentBase64: Buffer.from("<html><script>alert(1)</script></html>").toString("base64")
          },
          { uploadsDir, maxBytes: 1024 * 1024, publicBaseUrl: "https://example.com/uploads" }
        ),
      (error: unknown) => error instanceof UploadRejectedError && /does not match/i.test(error.message)
    );
  } finally {
    rmSync(uploadsDir, { recursive: true, force: true });
  }
});

test("uploadBase64Media accepts real PNG, JPEG and WebM signatures", async () => {
  const uploadsDir = mkdtempSync(join(tmpdir(), "capella-upload-test-"));
  try {
    const samples = [
      { mimeType: "image/png" as const, bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]) },
      { mimeType: "image/jpeg" as const, bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1]) },
      { mimeType: "video/webm" as const, bytes: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1]) }
    ];
    for (const sample of samples) {
      const result = await uploadBase64Media(
        { fileName: "sample", mimeType: sample.mimeType, contentBase64: sample.bytes.toString("base64") },
        { uploadsDir, maxBytes: 1024 * 1024, publicBaseUrl: "https://example.com/uploads" }
      );
      assert.ok(result.fileName);
    }
  } finally {
    rmSync(uploadsDir, { recursive: true, force: true });
  }
});

test("resolveUploadBodyLimitBytes leaves room for a base64-encoded file of the configured maximum", () => {
  const maxBytes = 20 * 1024 * 1024;
  const limit = resolveUploadBodyLimitBytes({ UPLOAD_MAX_BYTES: String(maxBytes) });
  assert.ok(limit >= Math.ceil(maxBytes / 3) * 4);
  assert.ok(limit < maxBytes * 2);
});
