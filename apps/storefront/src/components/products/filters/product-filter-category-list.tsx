"use client";

import type { CSSProperties } from "react";
import { pickLang, type Category, type Language } from "@capella/shared";

import { CategoryPill } from "../category-pill";
import type { CategoryTreeItem } from "../../../types/product-grid.types";

interface ProductFilterCategoryListProps {
  mode: "mobile" | "desktop";
  lang: Language;
  dict: any;
  category: number | undefined;
  setCategory: (value: number | undefined) => void;
  categories: Category[];
  categoryTree: CategoryTreeItem[];
  openParents: Record<number, boolean>;
  toggleParent: (id: number) => void;
}

const mobileListStyle = { display: "flex", flexWrap: "wrap", gap: 6 } as const;
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

function getIsOpen(
  parentId: number,
  category: number | undefined,
  children: Category[],
  openParents: Record<number, boolean>
) {
  return openParents[parentId] ?? Boolean(category && (category === parentId || children.some((item) => item.id === category)));
}

function getBranchStyles(isMobile: boolean) {
  return {
    branch: isMobile
      ? ({ display: "contents" } satisfies CSSProperties)
      : ({ display: "flex", flexDirection: "column", gap: 2 } satisfies CSSProperties),
    row: isMobile
      ? ({ display: "inline-flex", alignItems: "center", gap: 3 } satisfies CSSProperties)
      : ({ display: "flex", alignItems: "center", gap: 4 } satisfies CSSProperties),
    parentPillWrapper: isMobile ? undefined : ({ flex: 1, minWidth: 0 } satisfies CSSProperties),
    children: isMobile ? undefined : ({ display: "flex", flexDirection: "column", gap: 2 } satisfies CSSProperties)
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

  const renderChildren = (children: Category[]) => {
    const items = children.map((child) => renderPill(child, true));
    return styles.children ? <div style={styles.children}>{items}</div> : items;
  };

  const renderedTree = categoryTree.map(({ parent, children }) => {
    const isOpen = getIsOpen(parent.id, category, children, openParents);

    return (
      <div key={parent.id} style={styles.branch}>
        <div style={styles.row}>
          {styles.parentPillWrapper ? (
            <div style={styles.parentPillWrapper}>{renderPill(parent)}</div>
          ) : (
            renderPill(parent)
          )}
          {children.length > 0 && (
            <ParentToggle
              isOpen={isOpen}
              onClick={() => toggleParent(parent.id)}
              label={dict.filters.toggleCategory}
              compact={isMobile}
            />
          )}
        </div>
        {children.length > 0 && isOpen && renderChildren(children)}
      </div>
    );
  });

  return (
    <div style={isMobile ? mobileListStyle : desktopListStyle}>
      <CategoryPill name={name} checked={!category} onChange={() => setCategory(undefined)}>
        {dict.nav.allCategories}
      </CategoryPill>
      {categoryTree.length > 0 ? renderedTree : fallbackCategories.map((item) => renderPill(item))}
    </div>
  );
}
