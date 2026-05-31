"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
  { href: "/dashboard",  label: "الرئيسية",  icon: <Icon.Dashboard /> },
  { href: "/products",   label: "المنتجات",  icon: <Icon.Box />       },
  { href: "/categories", label: "الأقسام",   icon: <Icon.Folder />    },
  { href: "/collections", label: "المجموعات", icon: <Icon.Tag />      },
  { href: "/offers",     label: "العروض",    icon: <Icon.Tag />       },
  { href: "/advices",    label: "نصائح",     icon: <Icon.Sparkle />   },
  { href: "/orders",     label: "الطلبات",   icon: <Icon.Eye />       },
  { href: "/sales",      label: "المبيعات",  icon: <Icon.Tag />       },
  { href: "/trash",      label: "المحذوفات", icon: <Icon.Trash />     },
] as const;


/* Bottom bar shows these 4; "more" sheet shows the rest */
const BOTTOM_NAV = NAV.slice(0, 4);
const MORE_NAV   = NAV.slice(4);

export function AdminShell({ title, crumbs = [], actions, children }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, hydrated, logout } = useAdminAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    if (hydrated && !user) router.replace("/login");
  }, [hydrated, user, router]);

  if (!hydrated) return null;
  if (!user) return null;

  const isMore = MORE_NAV.some((n) => pathname.startsWith(n.href));

  return (
    <div className="app-shell">
      {/* ── Desktop sidebar ───────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <Icon.Logo size={34} />
          <div className="sidebar__brand-text">
            <div className="sidebar__brand-name">Capella</div>
            <div className="sidebar__brand-tag">ERP</div>
          </div>
        </div>

        <div className="sidebar__nav">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="sidebar__link"
              data-active={n.href === "/dashboard" ? pathname === n.href : pathname.startsWith(n.href)}
            >
              {n.icon}<span>{n.label}</span>
            </Link>
          ))}
        </div>

        <div className="sidebar__user">
          <div className="sidebar__avatar">{user.name[0]}</div>
          <div className="sidebar__user-info">
            <div className="sidebar__user-name">{user.name}</div>
            <div className="sidebar__user-email">{user.email}</div>
          </div>
          <button
            className="sidebar__logout"
            onClick={() => { void logout().finally(() => router.replace("/login")); }}
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
          >
            <Icon.Logout />
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────── */}
      <div className="shell-main">
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

      {/* ── Mobile bottom navigation bar ─────────────── */}
      <nav className="mobile-nav" aria-label="التنقل">
        {BOTTOM_NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="mobile-nav__item"
            data-active={n.href === "/dashboard" ? pathname === n.href : pathname.startsWith(n.href)}
          >
            {n.icon}
            <span>{n.label}</span>
          </Link>
        ))}

        {/* More button */}
        <button
          className="mobile-nav__item"
          data-active={isMore || drawerOpen}
          onClick={() => setDrawerOpen(true)}
          aria-label="المزيد"
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
          </svg>
          <span>المزيد</span>
        </button>
      </nav>

      {/* ── Mobile "more" drawer ──────────────────────── */}
      {drawerOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer__handle" />

            <div className="mobile-drawer__user">
              <div className="sidebar__avatar" style={{ width: 40, height: 40 }}>{user.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{user.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
              </div>
            </div>

            <div className="mobile-drawer__links">
              {MORE_NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="mobile-drawer__link"
                  data-active={pathname.startsWith(n.href)}
                >
                  <span className="mobile-drawer__link-icon">{n.icon}</span>
                  <span>{n.label}</span>
                </Link>
              ))}
            </div>

            <div className="mobile-drawer__footer">
              <button
                className="btn btn--danger btn--block"
                onClick={() => { void logout().finally(() => router.replace("/login")); }}
              >
                <Icon.Logout /> تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
