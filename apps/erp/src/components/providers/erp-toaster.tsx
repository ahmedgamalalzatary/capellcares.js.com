"use client";

import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { Toaster } from "sonner";

/** Toasts sit at the bottom corner on the inline end, away from the rail and the page title. */
export function ErpToaster() {
  return (
    <Toaster
      position="bottom-left"
      dir="rtl"
      closeButton
      gap={10}
      offset={24}
      mobileOffset={16}
      icons={{
        success: <CircleCheck className="size-5 text-success" />,
        error: <CircleAlert className="size-5 text-danger" />,
        warning: <TriangleAlert className="size-5 text-warning" />,
        info: <Info className="size-5 text-info" />,
      }}
      toastOptions={{
        duration: 5000,
        unstyled: true,
        classNames: {
          toast:
            "group flex w-full items-start gap-3 rounded-well bg-surface p-4 pe-10 text-base text-text shadow-float sm:w-[380px]",
          icon: "mt-0.5 shrink-0",
          content: "grid min-w-0 gap-0.5",
          title: "font-medium text-text-strong",
          description: "text-sm text-text-muted",
          actionButton: "ms-auto h-8 shrink-0 rounded-control bg-sand-900 px-3 text-sm font-medium text-sand-50",
          cancelButton: "h-8 shrink-0 rounded-control px-3 text-sm text-text-2 hover:bg-hover",
          closeButton:
            "absolute end-2 top-2 grid size-7 place-items-center rounded-md text-text-muted hover:bg-hover hover:text-text-strong [&_svg]:size-3.5",
        },
      }}
    />
  );
}
