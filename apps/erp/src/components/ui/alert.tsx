import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  danger: { className: "bg-danger-soft text-danger", Icon: CircleAlert },
  warning: { className: "bg-warning-soft text-warning", Icon: TriangleAlert },
  info: { className: "bg-info-soft text-info", Icon: Info },
  success: { className: "bg-success-soft text-success", Icon: CircleCheck },
} as const;

/** Inline message on a soft wash of its state hue. Danger and warning are announced. */
export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { className: toneClass, Icon } = TONES[tone];
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-control px-3.5 py-3 text-sm leading-relaxed", toneClass, className)}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="grid min-w-0 gap-0.5">
        {title ? <p className="font-bold">{title}</p> : null}
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}
