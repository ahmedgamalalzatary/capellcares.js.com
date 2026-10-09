import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A well: the tray's white container. Elevation is one ring plus a 1px contact shadow — never border + wide shadow. */
export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section data-slot="card" className={cn("min-w-0 rounded-well bg-surface shadow-well", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 pb-4 sm:px-6", className)}>
      <div className="min-w-0">
        <h2 className="text-md font-bold">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-5 pb-5 sm:px-6 sm:pb-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"footer">) {
  return <footer className={cn("flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4 sm:px-6", className)} {...props} />;
}
