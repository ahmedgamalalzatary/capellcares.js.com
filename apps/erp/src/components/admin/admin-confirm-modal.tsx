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
  /** @deprecated legacy pages pass a class string; only its "danger" intent is read. */
  confirmClassName?: string;
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
  confirmClassName,
  disableCancel = false,
  disableConfirm = false,
  onClose,
  onConfirm,
  footerExtra,
  children
}: AdminConfirmModalProps) {
  const variant = tone ?? (confirmClassName?.includes("danger") ? "danger" : "primary");
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
