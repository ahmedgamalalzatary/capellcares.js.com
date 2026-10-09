"use client";

import type { ReactNode } from "react";
import { FormSaveBar } from "@/components/admin/form-save-bar";
import { formatNumber } from "@/lib/format";

/**
 * Shared shell for every new/edit page, after Shopify's resource-detail pattern: a ⅔ main column for the
 * content being edited and a ⅓ side column for short settings (status, organization, internal data).
 * Pair it with `<AdminShell width="form">` so the page is centered at a readable width; editors without
 * settings pass no `side` and use `width="narrow"`. The save bar rides the bottom of the viewport.
 */
export function EditorLayout({
  main,
  side,
  status,
  actions,
  notice,
}: {
  main: ReactNode;
  side?: ReactNode;
  /** One-line readiness/summary shown in the save bar. */
  status?: ReactNode;
  /** Cancel + Save buttons. */
  actions: ReactNode;
  /** Optional message above the columns (load warnings, validation summary). */
  notice?: ReactNode;
}) {
  return (
    <div className="grid gap-5">
      {notice}
      {side ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="grid min-w-0 gap-5 [&>[id]]:scroll-mt-20 lg:[&>[id]]:scroll-mt-8">{main}</div>
          <div className="grid min-w-0 gap-5 [&>[id]]:scroll-mt-20 lg:[&>[id]]:scroll-mt-8">{side}</div>
        </div>
      ) : (
        <div className="grid min-w-0 gap-5 [&>[id]]:scroll-mt-20 lg:[&>[id]]:scroll-mt-8">{main}</div>
      )}
      <FormSaveBar status={status} className="mt-0">
        {actions}
      </FormSaveBar>
    </div>
  );
}

export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Readiness line for editors with publish requirements. */
export function ReadinessStatus({ missingCount, onShowMissing }: { missingCount: number; onShowMissing?: () => void }) {
  if (missingCount === 0) {
    return (
      <span className="flex items-center gap-2">
        <span aria-hidden className="size-2 rounded-full bg-success" /> جاهز للنشر
      </span>
    );
  }
  const label = (
    <>
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
      <span>
        ينقص <span className="num">{formatNumber(missingCount)}</span> {missingCount === 1 ? "بيان" : "بيانات"} للنشر
      </span>
    </>
  );
  return onShowMissing ? (
    <button type="button" onClick={onShowMissing} className="flex items-center gap-2 text-start underline-offset-4 hover:text-text-strong hover:underline">
      {label}
    </button>
  ) : (
    <span className="flex items-center gap-2">{label}</span>
  );
}
