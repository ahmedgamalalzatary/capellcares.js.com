import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { parseUploadBody } from "../../src/modules/uploads/uploads.schemas.js";
import { uploadBase64Media } from "../../src/modules/uploads/uploads.service.js";

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
  const uploadsDir = mkdtempSync(join(tmpdir(), "minikoshk-upload-test-"));
  try {
    const result = await uploadBase64Media(
      {
        fileName: "body-lotion.webp",
        mimeType: "image/webp",
        contentBase64: Buffer.from("image-binary").toString("base64")
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
    assert.equal(writtenBytes.toString("utf8"), "image-binary");
  } finally {
    rmSync(uploadsDir, { recursive: true, force: true });
  }
});

test("uploadBase64Media saves video files without changing the extension", async () => {
  const uploadsDir = mkdtempSync(join(tmpdir(), "minikoshk-upload-test-"));
  try {
    const result = await uploadBase64Media(
      {
        fileName: "routine-demo.mp4",
        mimeType: "video/mp4",
        contentBase64: Buffer.from("video-binary").toString("base64")
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
    assert.equal(writtenBytes.toString("utf8"), "video-binary");
  } finally {
    rmSync(uploadsDir, { recursive: true, force: true });
  }
});

test("uploadBase64Media rejects oversized payloads", async () => {
  const uploadsDir = mkdtempSync(join(tmpdir(), "minikoshk-upload-test-"));
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
