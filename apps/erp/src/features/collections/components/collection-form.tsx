import { BundleForm } from "@/features/bundles/components/bundle-form";
import { collectionConfig } from "@/features/collections/collection-config";
import type { CollectionFormProps } from "@/features/collections/types";

/** Collection editor: the shared bundle form with the collection config. */
export function CollectionForm(props: CollectionFormProps) {
  return <BundleForm config={collectionConfig} {...props} />;
}
