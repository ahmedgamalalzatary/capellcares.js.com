"use client";

import type { ReactNode } from "react";
import { FormSaveBar } from "@/components/admin/form-save-bar";

/**
 * Shared shell for every new/edit page, after Shopify's resource-detail pattern: a ⅔ main column for the
 * content being edited and a ⅓ side column for short settings (status, organization, internal data).
 * Editors without a `side` render a single full-width column. The save bar rides the bottom of the viewport.
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
