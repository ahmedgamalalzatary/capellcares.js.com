import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { pickLang, type Category, type Language, type ProductAttribute } from "@capella/shared";
import { resolveMediaUrl } from "@/lib/api/client/normalizers";
import { ShopCardRow } from "@/components/shop/shop-card-row";

/** Tiles take these in turn, so neighbours never match. */
const TILE_COLORS = ["violet", "magenta", "blue", "cyan", "sunny"] as const;
const tileColor = (index: number) => TILE_COLORS[index % TILE_COLORS.length];

/** The logo's burst, small, marking the start of each section. */
function Burst() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[0.8em] shrink-0 fill-current">
      <path d="M12 0l2.2 7 5.3-5-2 7 7-1.5L19 12l5.5 4.5-7-1.5 2 7-5.3-5L12 24l-2.2-7-5.3 5 2-7-7 1.5L5 12 .5 7.500l7 1.5-2-7 5.3 5z" />
    </svg>
  );
}

export function ShopHeading({ children, color = "violet" }: { children: ReactNode; color?: (typeof TILE_COLORS)[number] }) {
  return (
    <h2 className={`shop-title shop-title--${color}`}>
      <Burst />
      <span>{children}</span>
    </h2>
  );
}

export function CategoryTiles({ categories, lang }: { categories: Category[]; lang: Language }) {
  return (
    <ul className="m-0 flex list-none flex-wrap justify-center gap-4 p-0 sm:gap-6">
      {categories.map((category, index) => {
        const name = pickLang(category.name, lang);
        return (
          <li key={category.id} className="w-[calc(50%-0.5rem)] sm:w-[calc((100%-3rem)/3)] lg:w-[calc((100%-4.5rem)/4)] xl:w-[calc((100%-7.5rem)/6)]">
            <Link href={`/${lang}/category/${category.slug}?categoryId=${category.id}`} className={`toy-tile toy-tile--${tileColor(index)}`}>
              <span className="toy-tile__media">
                {category.imagePath ? (
                  <Image src={category.imagePath} alt="" fill sizes="(min-width: 1280px) 16vw, (min-width: 640px) 33vw, 50vw" className="object-contain" />
                ) : null}
              </span>
              <span className="toy-tile__name">{name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AttributeRow({
  items,
  lang,
  basePath,
  shape
}: {
  items: ProductAttribute[];
  lang: Language;
  basePath: "brands" | "characters";
  shape: "plate" | "round";
}) {
  return (
    <ShopCardRow lang={lang} cols={3}>
      {items.map((item, index) => {
        const name = pickLang(item.name, lang);
        const imagePath = item.imagePath ? resolveMediaUrl(item.imagePath) : "";
        return (
          <Link key={item.id} href={`/${lang}/${basePath}/${item.slug}`} className={`toy-${shape} toy-${shape}--${tileColor(index)}`}>
            <span className={`toy-${shape}__media`}>
              {imagePath ? (
                <Image src={imagePath} alt="" fill sizes="(min-width: 1024px) 16vw, 42vw" className={shape === "round" ? "object-cover" : "object-contain"} />
              ) : (
                <span aria-hidden="true" className="toy-initial">{name.charAt(0)}</span>
              )}
            </span>
            <span className="toy-label">{name}</span>
          </Link>
        );
      })}
    </ShopCardRow>
  );
}
