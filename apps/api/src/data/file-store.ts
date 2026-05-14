import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mock, type Product, type Category, type Offer } from "@capella/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, "../../data.json");

export interface StoreShape {
  products: Product[];
  categories: Category[];
  offers: Offer[];
}

let state: StoreShape | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function seed(): StoreShape {
  return {
    products: mock.products.map((p) => ({ ...p, variants: p.variants.map((v: Product["variants"][number]) => ({ ...v })) })),
    categories: mock.categories.map((c) => ({ ...c })),
    offers: mock.offers.map((o) => ({ ...o, items: o.items.map((i: Offer["items"][number]) => ({ ...i })) }))
  };
}

async function load(): Promise<StoreShape> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as StoreShape;
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      const fresh = seed();
      await fs.writeFile(DATA_FILE, JSON.stringify(fresh, null, 2), "utf8");
      return fresh;
    }
    throw err;
  }
}

async function persist(): Promise<void> {
  if (!state) return;
  const snapshot = JSON.stringify(state, null, 2);
  writeQueue = writeQueue.then(() => fs.writeFile(DATA_FILE, snapshot, "utf8"));
  return writeQueue;
}

export async function getState(): Promise<StoreShape> {
  if (!state) state = await load();
  return state;
}

export async function save(): Promise<void> {
  await persist();
}

export async function resetStore(): Promise<void> {
  state = seed();
  await persist();
}

export function nextId(items: { id: number }[]): number {
  return items.reduce((acc, x) => Math.max(acc, x.id), 0) + 1;
}
