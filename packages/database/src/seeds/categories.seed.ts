import { categories } from "../../drizzle/schema.js";
import { db } from "../db.js";

export async function seedCategories() {
  await db.insert(categories).values([
    { slug: "body-care", arName: "العناية بالجسم", enName: "Body Care", isLeaf: false },
    { slug: "skin-care", arName: "العناية بالبشرة", enName: "Skin Care", isLeaf: false },
    { slug: "hair-care", arName: "العناية بالشعر", enName: "Hair Care", isLeaf: false },
    { slug: "body-lotion", arName: "لوشن الجسم", enName: "Body Lotion", isLeaf: true }
  ]);
}
