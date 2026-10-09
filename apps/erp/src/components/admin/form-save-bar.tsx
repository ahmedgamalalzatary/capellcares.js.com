import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The editor's save well. It rides the bottom of the viewport while the form scrolls,
 * so Save is always one tap away on every screen size.
 */
export function FormSaveBar({ status, children, className }: { status?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div
      data-slot="form-save-bar"
      className={cn(
        "sticky bottom-3 z-20 mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-well bg-surface px-4 py-3 shadow-float sm:px-5",
        "mb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <div className="min-w-0 flex-1 text-sm text-text-2">{status}</div>
      <div className="flex items-center gap-2 max-sm:w-full max-sm:*:flex-1">{children}</div>
    </div>
  );
}
