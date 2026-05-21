"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { Icon } from "@/components/ui/icons";

interface Crumb { label: string; href?: string }

interface Props {
  title: string;
  crumbs?: Crumb[];
  actions?: ReactNode;
  children: ReactNode;
}

const NAV = [
  { href: "/dashboard", label: "لوحة التحكم", icon: <Icon.Dashboard /> },
  { href: "/products", label: "المنتجات", icon: <Icon.Box /> },
  { href: "/categories", label: "الأقسام", icon: <Icon.Folder /> },
  { href: "/offers", label: "العروض", icon: <Icon.Tag /> },
  { href: "/advices", label: "نصائح كابيلا", icon: <Icon.Sparkle /> },
  { href: "/orders", label: "الطلبات", icon: <Icon.Eye /> },
  { href: "/trash", label: "المحذوفات", icon: <Icon.Trash /> }
];

export function AdminShell({ title, crumbs = [], actions, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, hydrated, logout } = useAdminAuth();

  useEffect(() => {
    if (hydrated && !user) router.replace("/login");
  }, [hydrated, user, router]);

  if (!hydrated) return null;
  if (!user) return null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <Icon.Logo size={32} />
          <div>
            <div className="sidebar__brand-name">Capella</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>ERP</div>
          </div>
        </div>
        <div className="sidebar__section">المنصة</div>
        {NAV.slice(0, 1).map((n) => (
          <Link key={n.href} href={n.href} className="sidebar__link" data-active={pathname === n.href}>
            {n.icon}<span>{n.label}</span>
          </Link>
        ))}
        <div className="sidebar__section">الكتالوج</div>
        {NAV.slice(1, 6).map((n) => (
          <Link key={n.href} href={n.href} className="sidebar__link" data-active={pathname.startsWith(n.href)}>
            {n.icon}<span>{n.label}</span>
          </Link>
        ))}
        <div className="sidebar__section">أخرى</div>
        {NAV.slice(6).map((n) => (
          <Link key={n.href} href={n.href} className="sidebar__link" data-active={pathname.startsWith(n.href)}>
            {n.icon}<span>{n.label}</span>
          </Link>
        ))}

        <div className="sidebar__user">
          <div className="sidebar__avatar">{user.name[0]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{user.email}</div>
          </div>
          <button
            onClick={() => { void logout().finally(() => router.replace("/login")); }}
            style={{ background: "transparent", border: 0, color: "rgba(255,255,255,0.6)", padding: 6 }}
            aria-label="خروج"
          >
            <Icon.Logout />
          </button>
        </div>
      </aside>

      <div>
        <header className="topbar">
          <div>
            <nav className="crumbs">
              <Link href="/dashboard">الرئيسية</Link>
              {crumbs.map((c, i) => (
                <span key={i}>{c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}</span>
              ))}
            </nav>
            <h1 className="page-title">{title}</h1>
          </div>
          <div className="row">{actions}</div>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
