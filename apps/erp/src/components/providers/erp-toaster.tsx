"use client";

import { Toaster } from "sonner";
import "./erp-toaster.css";

export function ErpToaster() {
  return (
    <Toaster
      className="erp-toaster"
      position="top-left"
      dir="rtl"
      richColors
      closeButton
      toastOptions={{
        duration: 5000,
        classNames: {
          toast: "erp-toast",
          title: "erp-toast__title",
          description: "erp-toast__description",
          actionButton: "erp-toast__action",
          cancelButton: "erp-toast__cancel",
          closeButton: "erp-toast__close"
        }
      }}
    />
  );
}
