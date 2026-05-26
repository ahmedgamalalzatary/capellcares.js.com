import type { ReactNode } from "react";

import { Breadcrumb, type Crumb } from "@/components/layout/breadcrumb";

interface StorefrontPageShellProps {
  breadcrumbItems: Crumb[];
  eyebrow: string;
  title: string;
  children: ReactNode;
}

export function StorefrontPageShell({
  breadcrumbItems,
  eyebrow,
  title,
  children
}: StorefrontPageShellProps) {
  return (
    <main className="container">
      <Breadcrumb items={breadcrumbItems} />
      <header className="page-head">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
      </header>
      {children}
    </main>
  );
}
