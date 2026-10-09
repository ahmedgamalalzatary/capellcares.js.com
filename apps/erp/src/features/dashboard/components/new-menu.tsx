"use client";

import { DropdownMenu } from "radix-ui";
import { BookOpen, FolderTree, Layers, Package, Plus, Tag } from "lucide-react";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { Button } from "@/components/ui/button";
import { RowMenuLink } from "@/components/ui/row-menu";
import { canCreateErpModule } from "@/lib/erp-permissions";
import { cn } from "@/lib/utils";

const items = [
  { module: "products", href: "/products/new", label: "منتج جديد", icon: <Package /> },
  { module: "offers", href: "/offers/new", label: "عرض جديد", icon: <Tag /> },
  { module: "collections", href: "/collections/new", label: "مجموعة جديدة", icon: <Layers /> },
  { module: "categories", href: "/categories/new", label: "قسم جديد", icon: <FolderTree /> },
  { module: "advices", href: "/advices/new", label: "نصيحة جديدة", icon: <BookOpen /> },
];

/** Every "create" page the person may open, behind one button. Hidden when they may create nothing. */
export function NewMenu() {
  const { user } = useAdminAuth();
  const allowed = items.filter((item) => canCreateErpModule(user, item.module));
  if (allowed.length === 0) return null;

  return (
    <DropdownMenu.Root dir="rtl" modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button variant="primary">
          <Plus aria-hidden />
          جديد
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-50 grid min-w-48 gap-0.5 rounded-control bg-surface p-1.5 shadow-float",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          {allowed.map((item) => (
            <RowMenuLink key={item.href} href={item.href}>
              {item.icon}
              {item.label}
            </RowMenuLink>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
