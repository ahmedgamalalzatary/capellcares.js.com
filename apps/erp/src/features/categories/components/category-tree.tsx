"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Pencil, Trash2 } from "lucide-react";
import type { Category } from "@capella/shared";
import { Button } from "@/components/ui/button";
import { RowMenu, RowMenuItem, RowMenuLink, RowMenuSeparator } from "@/components/ui/row-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Thumb } from "@/components/ui/thumb";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

function CountPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "nude" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs",
        tone === "nude" ? "bg-nude-soft text-nude-strong" : "bg-sunken text-text-2"
      )}
    >
      {children}
    </span>
  );
}

function TreeSkeleton() {
  return (
    <div aria-hidden className="grid">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-line py-3 pe-3 last:border-b-0"
          style={{ paddingInlineStart: `${(index % 3) * 24 + 12}px` }}
        >
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-9 rounded-thumb" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function Tree({
  children,
  depth,
  tree,
  productCount,
  canEdit,
  canDelete,
  reorderEnabled,
  filtering,
  onDelete,
  onMoveCategory,
  collapsed,
  onToggleCollapsed
}: {
  children: Category[];
  depth: number;
  tree: Map<number | null, Category[]>;
  productCount: Map<number, number>;
  canEdit: boolean;
  canDelete: boolean;
  reorderEnabled: boolean;
  filtering: boolean;
  onDelete: (id: number) => void;
  onMoveCategory: (parentId: number | null, id: number, direction: -1 | 1) => void;
  collapsed: Set<number>;
  onToggleCollapsed: (id: number) => void;
}) {
  return (
    <ul className="grid">
      {children.map((category) => {
        const kids = tree.get(category.id) ?? [];
        const count = productCount.get(category.id) ?? 0;
        const isRoot = depth === 0;
        const siblingIds = children.map((item) => item.id);
        const siblingIndex = siblingIds.indexOf(category.id);
        const hasKids = kids.length > 0;
        // While filtering, ancestors stay open so every match is visible.
        const isCollapsed = !filtering && collapsed.has(category.id);
        const initial = category.name.en?.trim().charAt(0) || category.name.ar?.trim().charAt(0) || "?";

        return (
          <li key={category.id} className="border-b border-line last:border-b-0">
            <div
              data-root={isRoot ? "true" : "false"}
              data-testid={`category-row-${category.id}`}
              className="group flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 pe-2 transition-colors hover:bg-sunken sm:flex-nowrap sm:pe-3"
              style={{ "--depth": depth, paddingInlineStart: `calc(${depth} * 1.5rem + 0.75rem)` } as CSSProperties}
            >
              {hasKids ? (
                <button
                  type="button"
                  className="grid size-8 shrink-0 place-items-center rounded-md text-text-muted transition-colors hover:bg-hover hover:text-text-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus pointer-coarse:size-11"
                  onClick={() => onToggleCollapsed(category.id)}
                  aria-label={isCollapsed ? "توسيع" : "طي"}
                  aria-expanded={!isCollapsed}
                  data-testid={`category-toggle-${category.id}`}
                >
                  <ChevronDown className={cn("size-4 transition-transform duration-200", isCollapsed && "rotate-180")} />
                </button>
              ) : (
                <span aria-hidden className="size-8 shrink-0 pointer-coarse:size-11" />
              )}

              <Thumb src={category.imagePath} fallback={initial} size="sm" />

              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <Link
                  href={`/categories/${category.id}/edit`}
                  className="truncate font-medium text-text-strong decoration-line-strong underline-offset-4 hover:underline"
                >
                  {category.name.ar}
                </Link>
                {category.name.en ? (
                  <span dir="ltr" className="truncate text-sm text-text-muted">{category.name.en}</span>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {count > 0 ? (
                  <CountPill>
                    <span className="num">{formatNumber(count)}</span> منتج
                  </CountPill>
                ) : null}
                {kids.length > 0 ? (
                  <CountPill tone="nude">
                    <span className="num">{formatNumber(kids.length)}</span> فرعي
                  </CountPill>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                {reorderEnabled && siblingIds.length > 1 ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="تحريك لأعلى"
                      title="تحريك لأعلى"
                      disabled={siblingIndex <= 0}
                      onClick={() => onMoveCategory(category.parentId, category.id, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="تحريك لأسفل"
                      title="تحريك لأسفل"
                      disabled={siblingIndex === -1 || siblingIndex >= siblingIds.length - 1}
                      onClick={() => onMoveCategory(category.parentId, category.id, 1)}
                    >
                      <ArrowDown />
                    </Button>
                  </>
                ) : null}
                {canEdit || canDelete ? (
                  <RowMenu label={`إجراءات ${category.name.ar}`}>
                    {canEdit ? (
                      <RowMenuLink href={`/categories/${category.id}/edit`}>
                        <Pencil /> تعديل
                      </RowMenuLink>
                    ) : null}
                    {canDelete ? (
                      <>
                        <RowMenuSeparator />
                        <RowMenuItem danger onClick={() => onDelete(category.id)}>
                          <Trash2 /> حذف
                        </RowMenuItem>
                      </>
                    ) : null}
                  </RowMenu>
                ) : null}
              </div>
            </div>

            {hasKids ? (
              <div
                data-collapsed={isCollapsed ? "true" : "false"}
                data-testid={`category-subtree-${category.id}`}
                aria-hidden={isCollapsed || undefined}
                className="grid grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity] duration-200 ease-out data-[collapsed=true]:grid-rows-[0fr] data-[collapsed=true]:opacity-0 motion-reduce:transition-none"
              >
                <div className="min-h-0 overflow-hidden" inert={isCollapsed || undefined}>
                  <Tree
                    children={kids}
                    depth={depth + 1}
                    tree={tree}
                    productCount={productCount}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    reorderEnabled={reorderEnabled}
                    filtering={filtering}
                    onDelete={onDelete}
                    onMoveCategory={onMoveCategory}
                    collapsed={collapsed}
                    onToggleCollapsed={onToggleCollapsed}
                  />
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export { Tree, TreeSkeleton };
