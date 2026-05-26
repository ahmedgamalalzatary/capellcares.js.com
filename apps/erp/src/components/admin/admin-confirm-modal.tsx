import type { ReactNode } from "react";

import { Modal } from "@/components/ui/modal";

interface AdminConfirmModalProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
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
  confirmClassName = "btn btn--primary btn--sm",
  disableCancel = false,
  disableConfirm = false,
  onClose,
  onConfirm,
  footerExtra,
  children
}: AdminConfirmModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn--ghost btn--sm" disabled={disableCancel} onClick={onClose}>{cancelLabel}</button>
          {footerExtra}
          <button className={confirmClassName} disabled={disableConfirm} onClick={() => void onConfirm()}>{confirmLabel}</button>
        </>
      )}
    >
      {children}
    </Modal>
  );
}
