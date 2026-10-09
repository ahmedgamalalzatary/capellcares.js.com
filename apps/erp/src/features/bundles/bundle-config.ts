import type { ComponentType } from "react";
import type { BundleEntity, BundleSavePayload } from "@/features/bundles/types";

/** The list-screen copy that differs between an offer and a collection. */
export interface BundleListCopy {
  title: string;
  description: string;
  searchPlaceholder: string;
  countNoun: string;
  newLabel: string;
  saveOrderLabel: string;
  forbiddenMessage: string;
  toggleOnMessage: string;
  toggleOffMessage: string;
  deleteConfirmLabel: string;
  deleteModalText: string;
  reorderSuccess: string;
  reorderError: string;
  deleteError: string;
  toggleError: string;
  emptyTitle: string;
  /** Offer-only: the message shown when an offer has no category and cannot be activated. */
  activateNeedsCategory: string;
}

export interface BundleListConfig {
  copy: BundleListCopy;
  /** Columns for the phone sort select and the sortable header row. */
  columns: Array<{ key: string; label: string }>;
  /** Offers show a savings column; collections don't. */
  showSavings: boolean;
  /** A legacy offer with no category cannot be activated; collections have no such rule. */
  requireCategoryToToggle: boolean;
  icon: ComponentType<{ className?: string }>;
  sortAccessors: (categories: Array<{ id: number; name: { ar: string } }>) => Record<string, (bundle: BundleEntity) => string | number | null | undefined>;
}


/** The screen copy that differs between an offer and a collection (shared strings live in the component). */
export interface BundleFormCopy {
  basicsTitle: string;
  bundleLabel: string;
  bundleTitle: string;
  bundleDescription: string;
  mediaTitle: string;
  mediaDescription: string;
  relatedDescription: string;
  statusInactiveHint: string;
  statusActiveHint: string;
  primaryPublish: string;
  primarySave: string;
  bundleHeading: string;
  bundleHeadingHint: string;
  bundleEmptyTitle: string;
  bundleEmptyHint: string;
  priceLabel: string;
  priceHint: string;
  savingsWarning: string;
  hoverDescription: string;
  statusHeading: string;
  entityLabel: string;
}

/** Every string that differs between an offer and a collection; everything else lives in the shared hook. */
export interface BundleCopy {
  form: BundleFormCopy;
  requirementError: {
    nameAr: string;
    nameEn: string;
    categoryId: string;
    price: string;
    rows: string;
    image: string;
  };
  requirementLabel: {
    price: string;
    rows: string;
    image: string;
  };
  validation: {
    price: string;
    /** Shown when an entity that allows a single row has none (offers). */
    rowsEmpty: string;
    rowsIncomplete: string;
    /** Shown when the same variant repeats (collections). */
    rowsRepeated: string;
    draftName: string;
  };
  saveError: string;
}

export interface BundleConfig {
  kind: "offer" | "collection";
  copy: BundleCopy;
  list: BundleListConfig;
  rules: {
    minRows: number;
    requireDistinctVariants: boolean;
  };
  storeApi: {
    reorder: (ids: number[]) => Promise<void>;
    softDelete: (id: number) => Promise<void>;
    toggleStatus: (id: number) => Promise<void>;
  };
  upsert: (bundle: BundleSavePayload) => Promise<void>;
}
