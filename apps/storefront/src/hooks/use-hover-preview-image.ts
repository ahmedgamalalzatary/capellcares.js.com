"use client";

import { useEffect, useState } from "react";

/**
 * The one hover-image preview pipeline every storefront card shares: the card shows
 * `primaryImage` until the pointer enters, then swaps to `hoverImagePath` (falling back
 * to the primary image when no dedicated hover image exists), and restores the primary
 * on leave. Also re-syncs when the localized primary image changes.
 */
export function useHoverPreviewImage(primaryImage: string, hoverImagePath?: string | null) {
  const hoverImage = hoverImagePath || primaryImage;
  const [previewImage, setPreviewImage] = useState(primaryImage);

  useEffect(() => {
    setPreviewImage(primaryImage);
  }, [primaryImage]);

  return {
    previewImage,
    hoverProps: {
      onMouseEnter: () => setPreviewImage(hoverImage),
      onMouseLeave: () => setPreviewImage(primaryImage)
    }
  };
}
