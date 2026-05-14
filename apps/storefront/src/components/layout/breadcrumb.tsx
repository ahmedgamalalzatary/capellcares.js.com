import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import styles from "./breadcrumb.module.css";

export interface Crumb { label: string; href?: string }

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className={styles.bc} aria-label="Breadcrumb">
      {items.map((c, i) => (
        <span key={i} className={styles.item}>
          {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
          {i < items.length - 1 && <Icon.Chevron size={12} className="arrow-flip" />}
        </span>
      ))}
    </nav>
  );
}
