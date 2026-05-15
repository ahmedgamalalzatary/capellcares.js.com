import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { parseUploadBody } from "../src/modules/uploads/uploads.schemas.js";
import { uploadBase64Image } from "../src/modules/uploads/uploads.service.js";

test("parseUploadBody accepts valid image upload payload", () => {
  const parsed = parseUploadBody({
    fileName: "cream.png",
    mimeType: "image/png",
    contentBase64: Buffer.from("hello").toString("base64")
  });

  assert.equal(parsed.fileName, "cream.png");
  assert.equal(parsed.mimeType, "image/png");
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

test("uploadBase64Image saves file and returns public URL + path", async () => {
  const uploadsDir = mkdtempSync(join(tmpdir(), "capella-upload-test-"));
  try {
    const result = await uploadBase64Image(
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

test("uploadBase64Image rejects oversized payloads", async () => {
  const uploadsDir = mkdtempSync(join(tmpdir(), "capella-upload-test-"));
  try {
    const huge = Buffer.alloc(11).fill("a").toString("base64");
    await assert.rejects(
      () =>
        uploadBase64Image(
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
