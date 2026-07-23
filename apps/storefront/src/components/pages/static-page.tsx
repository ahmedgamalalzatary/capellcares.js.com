import type { Language } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";

export interface StaticBlock {
  h?: string;
  p?: string;
  ul?: readonly string[];
}

export interface StaticPageContent {
  title: string;
  blocks: readonly StaticBlock[];
}

/**
 * Renders a long-form informational page (legal, about, …) from structured
 * dictionary content. Sticks to the existing design tokens — no new ones.
 */
export function StaticPage({
  lang,
  dict,
  content
}: {
  lang: Language;
  dict: any;
  content: StaticPageContent;
}) {
  return (
    <main className="container">
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: content.title }
        ]}
      />
      <article className="mx-auto w-full max-w-3xl pb-16">
        <header className="page-head">
          <h1>{content.title}</h1>
        </header>

        <div className="grid gap-5 text-base leading-[1.8] text-(--ink-2)">
          {content.blocks.map((block, i) => {
            if (block.h) {
              return (
                <h2
                  key={i}
                  className="mt-5 text-lg font-semibold text-ink font-(family-name:--font-display)"
                >
                  {block.h}
                </h2>
              );
            }
            if (block.ul) {
              return (
                <ul
                  key={i}
                  className="grid gap-2 ps-5 list-disc marker:text-(--accent)"
                >
                  {block.ul.map((item, j) => (
                    <li key={j} className="leading-[1.8]">
                      {item}
                    </li>
                  ))}
                </ul>
              );
            }
            return <p key={i}>{block.p}</p>;
          })}
        </div>
      </article>
    </main>
  );
}
