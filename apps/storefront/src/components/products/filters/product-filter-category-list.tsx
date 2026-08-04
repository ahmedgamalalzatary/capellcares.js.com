"use client";

import { pickLang, type Category, type Language } from "@capella/shared";

import { cn } from "@/lib/utils";
import { CategoryPill } from "../category-pill";
import type { CategoryTreeNode } from "../../../types/product-grid.types";

interface ProductFilterCategoryListProps {
  mode: "mobile" | "desktop";
  lang: Language;
  dict: any;
  category: number | undefined;
  setCategory: (value: number | undefined) => void;
  categories: Category[];
  categoryTree: CategoryTreeNode[];
  openParents: Record<number, boolean>;
  toggleParent: (id: number) => void;
}

const mobileListClass = "flex flex-col gap-1.5";
const desktopListClass =
  "flex max-h-[260px] flex-col gap-1 overflow-y-auto pe-[2px] [scrollbar-color:var(--hairline)_transparent] [scrollbar-width:thin]";

function ParentToggle({
  isOpen,
  onClick,
  label,
  compact
}: {
  isOpen: boolean;
  onClick: () => void;
  label: string;
  compact: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={isOpen}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-(--hairline) text-(--ink-3) transition-[background] duration-[160ms]",
        compact ? "size-5" : "size-6",
        isOpen ? "bg-[oklch(0_0_0_/_0.06)]" : "bg-transparent"
      )}
    >
      <svg
        width="8"
        height="8"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className={cn(
          "transition-transform duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          isOpen ? "rotate-90" : "rotate-0"
        )}
      >
        <path d="M3 2l4 3-4 3" />
      </svg>
    </button>
  );
}

function branchContains(node: CategoryTreeNode, targetId: number): boolean {
  if (node.category.id === targetId) return true;
  return node.children.some((child) => branchContains(child, targetId));
}

function getIsOpen(node: CategoryTreeNode, category: number | undefined, openParents: Record<number, boolean>) {
  return openParents[node.category.id] ?? Boolean(category && branchContains(node, category));
}

function getBranchClasses(isMobile: boolean) {
  return {
    branch: "flex flex-col gap-[2px]",
    row: isMobile ? "inline-flex items-center gap-[3px]" : "flex items-center gap-1",
    parentPillWrapper: isMobile ? undefined : "min-w-0 flex-1",
    children: "flex flex-col gap-[2px]"
  } as const;
}

export function ProductFilterCategoryList({
  mode,
  lang,
  dict,
  category,
  setCategory,
  categories,
  categoryTree,
  openParents,
  toggleParent
}: ProductFilterCategoryListProps) {
  const isMobile = mode === "mobile";
  const name = isMobile ? "cat-mobile" : "cat";
  const fallbackCategories = categories.slice(0, 14);
  const classes = getBranchClasses(isMobile);

  const renderPill = (item: Category, indent = false) => (
    <CategoryPill key={item.id} name={name} checked={category === item.id} onChange={() => setCategory(item.id)} indent={indent}>
      {pickLang(item.name, lang)}
    </CategoryPill>
  );

  const renderNode = (node: CategoryTreeNode, depth = 0): React.ReactNode => {
    const isOpen = getIsOpen(node, category, openParents);
    const childContent = node.children.map((child) => renderNode(child, depth + 1));

    return (
      <div key={node.category.id} className={classes.branch}>
        <div className={classes.row}>
          {classes.parentPillWrapper ? (
            <div className={classes.parentPillWrapper}>{renderPill(node.category, depth > 0)}</div>
          ) : (
            renderPill(node.category, depth > 0)
          )}
          {node.children.length > 0 && (
            <ParentToggle
              isOpen={isOpen}
              onClick={() => toggleParent(node.category.id)}
              label={dict.filters.toggleCategory}
              compact={isMobile}
            />
          )}
        </div>
        {node.children.length > 0 && isOpen && (classes.children ? <div className={classes.children}>{childContent}</div> : childContent)}
      </div>
    );
  };

  const renderedTree = categoryTree.map((node) => renderNode(node));

  return (
    <div className={isMobile ? mobileListClass : desktopListClass}>
      <CategoryPill name={name} checked={!category} onChange={() => setCategory(undefined)}>
        {dict.nav.allCategories}
      </CategoryPill>
      {categoryTree.length > 0 ? renderedTree : fallbackCategories.map((item) => renderPill(item))}
    </div>
  );
}
