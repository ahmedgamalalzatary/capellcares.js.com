import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";

test("every Disp​​acito seed image is stored in the tracked seed-assets directory", async () => {
  const source = await readFile(
    new URL("../src/seeds/despacito.seed.ts", import.meta.url),
    "utf8"
  );
  const imageNames = [
    ...source.matchAll(/(?:image|hover): "\/uploads\/([^"]+)"/g)
  ].map((match) => match[1]);

  assert.ok(imageNames.length > 0, "seed must reference at least one upload");

  for (const imageName of imageNames) {
    const assetUrl = new URL(`../src/seeds/assets/${imageName}`, import.meta.url);
    await assert.doesNotReject(
      access(assetUrl),
      `missing tracked seed asset: ${imageName}`
    );
  }
});

test("the production seed loads Disp​​acito data and copies its upload assets", async () => {
  const source = await readFile(
    new URL("../src/seeds/index.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /import \{ seedDespacito \}/);
  assert.match(source, /import \{ copySeedAssets \}/);
  assert.match(source, /await seedDespacito\(\)/);
  assert.match(source, /await copySeedAssets\(\)/);
});

test("Docker exposes the seed as an explicit tool with persistent upload storage", async () => {
  const compose = await readFile(
    new URL("../../../docker-compose.yml", import.meta.url),
    "utf8"
  );

  assert.match(compose, /^  seed:\r?$/m);
  assert.match(compose, /UPLOADS_DIR: \/app\/apps\/api\/uploads/);
  assert.match(compose, /command: \["pnpm", "db:seed"\]/);
  assert.match(compose, /profiles: \["tools"\]/);
  assert.match(compose, /- api-uploads:\/app\/apps\/api\/uploads/);
});
