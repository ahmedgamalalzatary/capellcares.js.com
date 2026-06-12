"use client";

import type { CSSProperties } from "react";
import { pickLang, type Category, type Language } from "@capella/shared";

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

const mobileListStyle = { display: "flex", flexDirection: "column", gap: 6 } as const;
const desktopListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  maxHeight: "260px",
  overflowY: "auto",
  paddingInlineEnd: "2px",
  scrollbarWidth: "thin",
  scrollbarColor: "oklch(1 0 0 / 0.1) transparent"
} as const;

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
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: compact ? 20 : 24,
        height: compact ? 20 : 24,
        borderRadius: "50%",
        border: "1px solid oklch(1 0 0 / 0.14)",
        background: isOpen ? "oklch(1 0 0 / 0.1)" : "transparent",
        color: "oklch(0.94 0.06 85 / 0.5)",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 160ms"
      }}
    >
      <svg
        width="8"
        height="8"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        style={{
          transition: "transform 260ms cubic-bezier(0.16,1,0.3,1)",
          transform: isOpen ? "rotate(90deg)" : "rotate(0deg)"
        }}
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

function getBranchStyles(isMobile: boolean) {
  return {
    branch: ({ display: "flex", flexDirection: "column", gap: 2 } satisfies CSSProperties),
    row: isMobile
      ? ({ display: "inline-flex", alignItems: "center", gap: 3 } satisfies CSSProperties)
      : ({ display: "flex", alignItems: "center", gap: 4 } satisfies CSSProperties),
    parentPillWrapper: isMobile ? undefined : ({ flex: 1, minWidth: 0 } satisfies CSSProperties),
    children: ({ display: "flex", flexDirection: "column", gap: 2 } satisfies CSSProperties)
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
  const styles = getBranchStyles(isMobile);

  const renderPill = (item: Category, indent = false) => (
    <CategoryPill key={item.id} name={name} checked={category === item.id} onChange={() => setCategory(item.id)} indent={indent}>
      {pickLang(item.name, lang)}
    </CategoryPill>
  );

  const renderNode = (node: CategoryTreeNode, depth = 0): React.ReactNode => {
    const isOpen = getIsOpen(node, category, openParents);
    const childContent = node.children.map((child) => renderNode(child, depth + 1));

    return (
      <div key={node.category.id} style={styles.branch}>
        <div style={styles.row}>
          {styles.parentPillWrapper ? (
            <div style={styles.parentPillWrapper}>{renderPill(node.category, depth > 0)}</div>
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
        {node.children.length > 0 && isOpen && (styles.children ? <div style={styles.children}>{childContent}</div> : childContent)}
      </div>
    );
  };

  const renderedTree = categoryTree.map((node) => renderNode(node));

  return (
    <div style={isMobile ? mobileListStyle : desktopListStyle}>
      <CategoryPill name={name} checked={!category} onChange={() => setCategory(undefined)}>
        {dict.nav.allCategories}
      </CategoryPill>
      {categoryTree.length > 0 ? renderedTree : fallbackCategories.map((item) => renderPill(item))}
    </div>
  );
}
