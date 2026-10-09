import type { ComponentProps, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared control chrome: white field, one control-weight border, nude focus ring. */
export const controlClass = cn(
  "w-full min-w-0 rounded-control bg-surface text-base text-text-strong",
  "shadow-[0_0_0_1px_var(--line-control)] transition-[box-shadow,background-color] duration-150",
  "hover:shadow-[0_0_0_1px_var(--line-strong)]",
  "focus-visible:outline-none focus-visible:shadow-[0_0_0_1.5px_var(--focus),0_0_0_4px_var(--nude-soft)]",
  "aria-invalid:shadow-[0_0_0_1.5px_var(--danger)]",
  "disabled:cursor-not-allowed disabled:bg-sunken disabled:text-text-muted",
);

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(controlClass, "h-10 px-3 pointer-coarse:h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(controlClass, "min-h-28 resize-y px-3 py-2.5 leading-relaxed", className)} {...props} />;
}

/** Native select (keeps OS pickers on phones) with the ERP chrome and a chevron on the inline end. */
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <span className={cn("relative inline-flex min-w-0", className)}>
      <select
        data-slot="select"
        className={cn(controlClass, "h-10 cursor-pointer appearance-none pe-9 ps-3 pointer-coarse:h-11")}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
    </span>
  );
}

/** Input with a short unit at the inline end (ج.م, %). */
export function InputWithAddon({ addon, className, ...props }: ComponentProps<"input"> & { addon: ReactNode }) {
  return (
    <span className={cn("relative flex min-w-0", className)}>
      <Input className="pe-12" {...props} />
      <span aria-hidden className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">{addon}</span>
    </span>
  );
}

/** Input with a leading icon (search fields). */
export function InputWithIcon({ icon, className, ...props }: ComponentProps<"input"> & { icon: ReactNode }) {
  return (
    <span className={cn("relative flex min-w-0", className)}>
      <span aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-muted [&_svg]:size-[18px]">{icon}</span>
      <Input className="ps-10" {...props} />
    </span>
  );
}
