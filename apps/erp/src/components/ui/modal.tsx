"use client";

import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}

const WIDTH = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-2xl" } as const;

/** Centered dialog on desktop, bottom sheet on phones. Focus trap, Escape and outside-click come from Radix. */
export function Modal({ open, title, description, onClose, footer, children, size = "md" }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          dir="rtl"
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed z-50 grid w-full gap-0 bg-surface shadow-float outline-none",
            "max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[90dvh] max-sm:rounded-t-[20px] max-sm:pb-[env(safe-area-inset-bottom)]",
            "sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-well",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 max-sm:data-[state=open]:slide-in-from-bottom-8 sm:data-[state=open]:zoom-in-95",
            WIDTH[size],
          )}
        >
          <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
            <div className="grid gap-1">
              <Dialog.Title className="text-lg font-bold text-text-strong">{title}</Dialog.Title>
              {description ? <Dialog.Description className="text-sm text-text-muted">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close
              aria-label="إغلاق"
              className="-me-2 -mt-1 grid size-9 shrink-0 place-items-center rounded-control text-text-muted hover:bg-hover hover:text-text-strong"
            >
              <X className="size-[18px]" />
            </Dialog.Close>
          </header>
          <div className="overflow-y-auto px-6 py-3 text-base text-text">{children}</div>
          {footer ? <footer className="flex flex-wrap-reverse justify-end gap-2 px-6 pt-3 pb-6 max-sm:[&>*]:flex-1">{footer}</footer> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
