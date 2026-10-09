"use client";

import { useBundleForm } from "@/features/bundles/hooks/use-bundle-form";
import { collectionConfig } from "@/features/collections/collection-config";
import type { CollectionFormProps, UseCollectionFormResult } from "@/features/collections/types";

export function useCollectionForm(props: CollectionFormProps): UseCollectionFormResult {
  return useBundleForm(collectionConfig, props);
}
