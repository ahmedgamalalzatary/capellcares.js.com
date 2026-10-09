"use client";

import { useState } from "react";
import type { HoverImagePaths } from "@capella/shared";

/**
 * The one hover-image form pipeline every entity editor shares: hydrates the localized
 * values from the entity being edited and derives the save payload (`hoverImagePath`
 * carries the English value for legacy readers, the localized fields carry their own).
 */
export function useHoverImageFields(initial?: HoverImagePaths | null) {
  const [arHoverImagePath, setArHoverImagePath] = useState(initial?.arHoverImagePath ?? "");
  // An explicitly null English value means the admin cleared it; only an absent field falls back to the legacy path.
  const [enHoverImagePath, setEnHoverImagePath] = useState(
    initial?.enHoverImagePath !== undefined ? initial.enHoverImagePath ?? "" : initial?.hoverImagePath ?? ""
  );

  const hoverImagePayload = {
    hoverImagePath: enHoverImagePath,
    arHoverImagePath: arHoverImagePath || null,
    enHoverImagePath: enHoverImagePath || null
  };

  return {
    arHoverImagePath,
    setArHoverImagePath,
    enHoverImagePath,
    setEnHoverImagePath,
    hoverImagePayload
  };
}
