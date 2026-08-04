import assert from "node:assert/strict";
import test from "node:test";
import { parseEntityMediaInput } from "../../src/repositories/entity-media.repository.js";

test("parseEntityMediaInput rejects more than one video", () => {
  assert.throws(
    () => parseEntityMediaInput([
      { type: "video", url: "/uploads/one.mp4" },
      { type: "video", url: "/uploads/two.mp4" }
    ]),
    (error: any) => error?.code === "ENTITY_MEDIA_VIDEO_LIMIT"
  );
});
