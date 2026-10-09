import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "danger";
  className?: string;
}) {
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={cn("grid justify-items-center gap-3 px-6 py-14 text-center", className)}>
      {icon ? (
        <span
          aria-hidden
          className={cn(
            "grid size-14 place-items-center rounded-well bg-sunken shadow-inset [&_svg]:size-6",
            tone === "danger" ? "text-danger" : "text-text-muted",
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="grid max-w-sm gap-1">
        <p className="text-md font-bold text-text-strong">{title}</p>
        {description ? <p className="text-sm text-text-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
