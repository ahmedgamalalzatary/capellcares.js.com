"use client";

import { RefreshCw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileButton } from "@/components/ui/file-button";
import { IMAGE_ACCEPT } from "@/lib/media";

interface Props {
  hasImage: boolean;
  busy: boolean;
  canUpload: boolean;
  /** Read-only field: the image cannot be removed either. */
  disabled?: boolean;
  onFiles: (files: FileList | null) => void;
  onRemove: () => void;
  removeLabel: string;
  inputTestId?: string;
  replaceLabel?: string;
  className?: string;
}

/** Upload/replace + remove controls for a single image, shared by every image field. */
export function ImageActions({
  hasImage,
  busy,
  canUpload,
  disabled = false,
  onFiles,
  onRemove,
  removeLabel,
  inputTestId,
  replaceLabel = "استبدال",
  className
}: Props) {
  return (
    <div className={className ? `flex items-center gap-1 ${className}` : "flex items-center gap-1"}>
      <FileButton
        data-testid={inputTestId}
        accept={IMAGE_ACCEPT}
        disabled={!canUpload}
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = "";
        }}
      >
        {hasImage ? <RefreshCw /> : <Upload />}
        {hasImage ? replaceLabel : "رفع صورة"}
      </FileButton>
      {hasImage ? (
        <Button variant="danger-ghost" size="icon-sm" aria-label={removeLabel} disabled={busy || disabled} onClick={onRemove}>
          <Trash2 />
        </Button>
      ) : null}
    </div>
  );
}
