"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Dialog } from "radix-ui";
import {
  ChartColumn, ChevronLeft, FolderTree, Gift, Images, Layers, LayoutDashboard, Lightbulb,
  LogOut, Menu, Package, Percent, ShoppingBag, Star, Trash2, Truck, Users, X, type LucideIcon,
} from "lucide-react";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { OrderReviewFlagAlerts } from "@/features/orders/components/order-review-flag-alerts";
import { cn } from "@/lib/utils";
import { hasErpPermission } from "@/lib/erp-permissions";
import type { AdminAuthUser } from "@/lib/api/client";
import { ThemeMenu } from "./theme-menu";

interface Crumb { label: string; href?: string }

interface Props {
  title: string;
  /** One line under the title saying what the page is for. */
  description?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
  children: ReactNode;
}

interface NavItem { href: string; label: string; icon: LucideIcon; permission?: string }
interface NavGroup { label?: string; items: NavItem[] }

const NAV: NavGroup[] = [
  { items: [{ href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard, permission: "dashboard.read" }] },
  {
    label: "الكتالوج",
    items: [
      { href: "/products", label: "المنتجات", icon: Package, permission: "products.read" },
      { href: "/categories", label: "الأقسام", icon: FolderTree, permission: "categories.read" },
      { href: "/offers", label: "العروض", icon: Gift, permission: "offers.read" },
      { href: "/collections", label: "المجموعات", icon: Layers, permission: "collections.read" },
      { href: "/discounts", label: "الخصومات", icon: Percent, permission: "discounts.manage" },
    ],
  },
  {
    label: "الطلبات والمبيعات",
    items: [
      { href: "/orders", label: "الطلبات", icon: ShoppingBag, permission: "orders.read" },
      { href: "/shipping", label: "الشحن", icon: Truck, permission: "shipping.read" },
      { href: "/sales", label: "المبيعات", icon: ChartColumn, permission: "sales.read" },
    ],
  },
  {
    label: "محتوى المتجر",
    items: [
      { href: "/advices", label: "النصائح", icon: Lightbulb, permission: "advices.read" },
      { href: "/shop-media", label: "وسائط المتجر", icon: Images, permission: "shop_media.read" },
      { href: "/reviews", label: "التقييمات", icon: Star, permission: "reviews.read" },
    ],
  },
  {
    label: "الإدارة",
    items: [
      { href: "/staff", label: "فريق العمل", icon: Users },
      { href: "/trash", label: "المحذوفات", icon: Trash2, permission: "trash.read" },
    ],
  },
];

function canAccess(user: AdminAuthUser, item: NavItem) {
  // Staff management is admin-only.
  return !item.permission ? user.role === "admin" : hasErpPermission(user, item.permission);
}

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function BrandMark({ className }: { className?: string }) {
  // The logo's face circle, cropped from the official lockup.
  return (
    <span
      aria-hidden
      className={cn("block size-9 shrink-0 rounded-full bg-[url('/brand/capella-logo.jpg')] bg-[length:auto_108%] bg-[position:2%_50%] shadow-[0_0_0_1px_oklch(1_0_0/0.08)]", className)}
    />
  );
}

function RailContent({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAdminAuth();
  if (!user) return null;

  const groups = NAV
    .map((group) => ({ ...group, items: group.items.filter((item) => canAccess(user, item)) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex h-full flex-col bg-rail text-rail-text">
      <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-3 px-5 pt-5 pb-4">
        <BrandMark />
        <span className="grid leading-tight">
          <span className="text-md font-bold tracking-wide text-rail-strong">Capella</span>
          <span className="text-xs text-rail-muted">لوحة إدارة المتجر</span>
        </span>
      </Link>

      <nav aria-label="القائمة الرئيسية" className="flex-1 overflow-y-auto px-3 pb-4 [scrollbar-color:var(--rail-line)_transparent]">
        {groups.map((group, index) => (
          <div key={group.label ?? index} className={cn(index > 0 && "mt-4")}>
            {group.label ? <p className="mb-1.5 px-3 text-xs font-medium text-rail-muted">{group.label}</p> : null}
            <ul className="grid gap-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const ItemIcon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex h-9 items-center gap-3 rounded-control px-3 text-base transition-colors duration-150 pointer-coarse:h-11",
                        "focus-visible:outline-rail-accent",
                        active ? "bg-rail-active font-medium text-rail-strong" : "text-rail-text hover:bg-rail-hover hover:text-rail-strong",
                      )}
                    >
                      <ItemIcon aria-hidden strokeWidth={1.75} className={cn("size-[18px] shrink-0", active ? "text-rail-accent" : "text-rail-muted group-hover:text-rail-text")} />
                      <span className="truncate">{item.label}</span>
                      {active ? <span aria-hidden className="ms-auto size-1.5 rounded-full bg-rail-accent" /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-1 border-t border-rail-line px-4 py-4">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-rail-active text-sm font-bold text-rail-accent">
          {user.name.trim().charAt(0)}
        </span>
        <span className="ms-2 me-1 grid min-w-0 flex-1 leading-tight">
          <span className="truncate text-sm font-medium text-rail-strong">{user.name}</span>
          <span dir="ltr" className="truncate text-end text-xs text-rail-muted">{user.email}</span>
        </span>
        <ThemeMenu />
        <button
          type="button"
          aria-label="تسجيل الخروج"
          title="تسجيل الخروج"
          onClick={() => { void logout().finally(() => router.replace("/login")); }}
          className="grid size-9 shrink-0 place-items-center rounded-control text-rail-muted transition-colors hover:bg-rail-hover hover:text-rail-strong focus-visible:outline-rail-accent"
        >
          <LogOut className="size-[18px] rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  );
}

export function AdminShell({ title, description, crumbs = [], actions, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, hydrated } = useAdminAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    if (hydrated && !user) router.replace("/login");
  }, [hydrated, user, router]);

  useEffect(() => {
    document.title = `${title} · Capella ERP`;
  }, [title]);

  if (!hydrated || !user) return null;

  return (
    <div className="min-h-dvh bg-canvas">
      <OrderReviewFlagAlerts />

      {/* Desktop rail */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-(--rail-width) border-e border-rail-line lg:block">
        <RailContent />
      </aside>

      {/* Tablet / phone top bar + drawer */}
      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas/95 px-4 backdrop-blur-sm lg:hidden">
          <Dialog.Trigger
            aria-label="فتح القائمة"
            className="-ms-2 grid size-11 place-items-center rounded-control text-text-strong hover:bg-hover"
          >
            <Menu className="size-[22px]" />
          </Dialog.Trigger>
          <Link href="/dashboard" className="flex items-center gap-2">
            <BrandMark className="size-7" />
            <span className="text-md font-bold text-text-strong">Capella</span>
          </Link>
        </div>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 lg:hidden" />
          <Dialog.Content
            dir="rtl"
            aria-describedby={undefined}
            className="fixed inset-y-0 start-0 z-50 w-[min(300px,86vw)] shadow-float outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right lg:hidden"
          >
            <Dialog.Title className="sr-only">القائمة الرئيسية</Dialog.Title>
            <Dialog.Close aria-label="إغلاق القائمة" className="absolute end-3 top-5 z-10 grid size-10 place-items-center rounded-control text-rail-muted hover:bg-rail-hover hover:text-rail-strong">
              <X className="size-5" />
            </Dialog.Close>
            <RailContent onNavigate={() => setDrawerOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="lg:ps-(--rail-width)">
        <main className="w-full px-4 pt-5 pb-16 sm:px-6 lg:px-[5%] lg:pt-8">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 lg:mb-8">
            <div className="min-w-0">
              <nav aria-label="مسار الصفحة" className="mb-1.5">
                <ol className="flex flex-wrap items-center gap-1 text-sm text-text-muted">
                  <li><Link href="/dashboard" className="rounded-sm hover:text-text-strong">الرئيسية</Link></li>
                  {crumbs.map((crumb, index) => (
                    <li key={index} className="flex items-center gap-1">
                      <ChevronLeft aria-hidden className="size-3.5 text-icon-faint" />
                      {crumb.href
                        ? <Link href={crumb.href} className="rounded-sm hover:text-text-strong">{crumb.label}</Link>
                        : <span aria-current={index === crumbs.length - 1 ? "page" : undefined}>{crumb.label}</span>}
                    </li>
                  ))}
                </ol>
              </nav>
              <h1 className="text-xl font-bold text-text-strong sm:text-[28px] sm:leading-tight">{title}</h1>
              {description ? <p className="mt-1 max-w-2xl text-base text-text-muted">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2 max-sm:w-full max-sm:[&>*]:flex-1">{actions}</div> : null}
          </header>

          {children}
        </main>
      </div>
    </div>
  );
}
