"use client";

import { useState } from "react";
import { api, type ErpUploadContext } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/errors";
import { validateImageFile } from "@/lib/media";

/** Shared single-image upload: validates, calls the API and exposes busy/error state. */
export function useImageUpload(uploadContext: ErpUploadContext) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null): Promise<string | null> => {
    const file = files?.[0];
    if (!file) return null;

    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return null;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await api.uploadImage(file, uploadContext);
      return result.url;
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, "تعذر رفع الصورة."));
      return null;
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, upload };
}
