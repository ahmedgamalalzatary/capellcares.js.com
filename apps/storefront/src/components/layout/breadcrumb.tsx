import Link from "next/link";
import { Icon } from "@/components/ui/icons";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav
      className="flex flex-wrap items-center gap-x-2 gap-y-1 py-7 text-[12.5px] tracking-[0.04em] text-(--ink-3)"
      aria-label="Breadcrumb"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-accent"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-ink" : ""}>{item.label}</span>
            )}
            {!isLast && (
              <Icon.Chevron size={11} className="arrow-flip opacity-60" />
            )}
          </span>
        );
      })}
    </nav>
  );
}
