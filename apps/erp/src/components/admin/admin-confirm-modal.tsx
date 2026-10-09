import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface AdminConfirmModalProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Visual weight of the confirm button. */
  tone?: "primary" | "danger";
  disableCancel?: boolean;
  disableConfirm?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  footerExtra?: ReactNode;
  children: ReactNode;
}

export function AdminConfirmModal({
  open,
  title,
  confirmLabel,
  cancelLabel = "إلغاء",
  tone,
  disableCancel = false,
  disableConfirm = false,
  onClose,
  onConfirm,
  footerExtra,
  children
}: AdminConfirmModalProps) {
  const variant = tone ?? "primary";
  return (
    <Modal
      open={open}
      title={title}
      size="sm"
      onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" disabled={disableCancel} onClick={onClose}>{cancelLabel}</Button>
          {footerExtra}
          <Button variant={variant} disabled={disableConfirm} onClick={() => void onConfirm()}>{confirmLabel}</Button>
        </>
      )}
    >
      {children}
    </Modal>
  );
}
