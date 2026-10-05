import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Language } from "@capella/shared";
import { ASK_STORAGE_KEY, CART_STORAGE_KEY, LANG_STORAGE_KEY, LEGACY_ASK_STORAGE_KEY } from "@/constants/storage";

type StorageBackend = Pick<typeof AsyncStorage, "getItem" | "setItem" | "multiRemove">;

export type PersistentValue<T> = {
  // Incompatible formats get a new versioned key. Keep previous keys intact
  // for supported rollback clients; never rewrite their serialization in place.
  key: string;
  decode: (raw: string) => T | null;
  encode: (value: T) => string;
  migrations?: readonly { key: string; decode: (raw: string) => T | null }[];
};

export const languageStorage: PersistentValue<Language> = {
  key: LANG_STORAGE_KEY,
  decode: (raw) => raw === "ar" || raw === "en" ? raw : null,
  encode: (value) => value
};

function decodeValue<T>(decode: (raw: string) => T | null, raw: string): T | null {
  try {
    return decode(raw);
  } catch {
    return null;
  }
}

export async function readPersistentValue<T>(
  specification: PersistentValue<T>,
  backend: StorageBackend = AsyncStorage
): Promise<T | null> {
  const raw = await backend.getItem(specification.key);
  if (raw !== null) return decodeValue(specification.decode, raw);

  for (const migration of specification.migrations ?? []) {
    const previous = await backend.getItem(migration.key);
    if (previous === null) continue;
    const value = decodeValue(migration.decode, previous);
    if (value === null) continue;
    const validated = decodeValue(specification.decode, specification.encode(value));
    if (validated === null) continue;
    const current = await backend.getItem(specification.key);
    if (current !== null) return decodeValue(specification.decode, current);
    await writePersistentValue(specification, validated, backend);
    return validated;
  }
  return null;
}

export async function writePersistentValue<T>(
  specification: PersistentValue<T>,
  value: T,
  backend: StorageBackend = AsyncStorage
): Promise<void> {
  const encoded = specification.encode(value);
  const validated = decodeValue(specification.decode, encoded);
  if (validated === null) {
    throw new Error("Invalid persistent value");
  }
  await backend.setItem(specification.key, specification.encode(validated));
}

export async function clearBrowsingCache(backend: StorageBackend = AsyncStorage): Promise<void> {
  // Account pending-sync, language, identity, secure tokens and payment recovery
  // are deliberately excluded. Never call AsyncStorage.clear() for this action.
  await backend.multiRemove([CART_STORAGE_KEY, ASK_STORAGE_KEY, LEGACY_ASK_STORAGE_KEY]);
}
