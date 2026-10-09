"use client";

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { Ellipsis } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A single "⋯" trigger that reveals a row's actions (edit, delete, …). Keyboard and screen-reader support come from Radix. */
export function RowMenu({ label = "إجراءات", children }: { label?: string; children: ReactNode }) {
  return (
    <DropdownMenu.Root dir="rtl" modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} title={label}>
          <Ellipsis />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-50 grid min-w-44 gap-0.5 rounded-control bg-surface p-1.5 shadow-float",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const itemClass = (danger?: boolean) =>
  cn(
    "flex h-9 w-full cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 text-start text-base outline-none pointer-coarse:h-11",
    "[&_svg]:size-4 [&_svg]:shrink-0",
    danger
      ? "text-danger data-[highlighted]:bg-danger-soft"
      : "text-text data-[highlighted]:bg-hover data-[highlighted]:text-text-strong [&_svg]:text-text-muted",
  );

export function RowMenuItem({
  danger,
  className,
  ...props
}: ComponentProps<"button"> & { danger?: boolean }) {
  return (
    <DropdownMenu.Item asChild>
      <button type="button" className={cn(itemClass(danger), className)} {...props} />
    </DropdownMenu.Item>
  );
}

export function RowMenuLink({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <DropdownMenu.Item asChild>
      <Link className={cn(itemClass(false), className)} {...props} />
    </DropdownMenu.Item>
  );
}

export function RowMenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}
