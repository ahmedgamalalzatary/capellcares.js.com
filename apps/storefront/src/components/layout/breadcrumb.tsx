import Link from "next/link";
import { Icon } from "@/components/ui/icons";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-2 py-6 text-[13px] text-(--ink-3)" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-accent">
              {item.label}
            </Link>
          ) : (
            <span>{item.label}</span>
          )}
          {index < items.length - 1 && <Icon.Chevron size={12} className="arrow-flip" />}
        </span>
      ))}
    </nav>
  );
}

