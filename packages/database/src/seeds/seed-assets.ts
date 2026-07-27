import { copyFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const seedAssetsDirectory = fileURLToPath(new URL("./assets/", import.meta.url));
const defaultUploadsDirectory = fileURLToPath(
  new URL("../../../../apps/api/uploads/", import.meta.url)
);

export async function copySeedAssets(
  uploadsDirectory = process.env.UPLOADS_DIR?.trim() || defaultUploadsDirectory
) {
  await mkdir(uploadsDirectory, { recursive: true });

  const entries = await readdir(seedAssetsDirectory, { withFileTypes: true });
  const imageFiles = entries.filter(
    (entry) => entry.isFile() && /\.(?:jpe?g|png|webp)$/i.test(entry.name)
  );

  await Promise.all(
    imageFiles.map((entry) =>
      copyFile(
        fileURLToPath(new URL(`./assets/${entry.name}`, import.meta.url)),
        `${uploadsDirectory}/${entry.name}`
      )
    )
  );

  return imageFiles.map((entry) => entry.name);
}
