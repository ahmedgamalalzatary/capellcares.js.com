import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { pickLang, type Category, type Language, type ProductAttribute } from "@capella/shared";
import { resolveMediaUrl } from "@/lib/api/client/normalizers";
import { ShopCardRow } from "@/components/shop/shop-card-row";
import { Icon } from "@/components/ui/icons";

/** Brand plates take these in turn, so neighbours never match. */
const PLATE_COLORS = ["violet", "magenta", "blue", "cyan", "sunny"] as const;

export function ShopHeading({ children, color = "violet" }: { children: ReactNode; color?: "violet" | "magenta" | "blue" | "cyan" | "sunny" }) {
  return (
    <h2 className={`shop-title shop-title--${color}`}>
      <span>{children}</span>
    </h2>
  );
}

/** One category card: its picture, then its name. Shared by the shop page's row and the all categories page's grid, so both look the same. */
function CategoryTile({ category, lang }: { category: Category; lang: Language }) {
  return (
    <Link href={`/${lang}/category/${category.slug}?categoryId=${category.id}`} className="toy-tile">
      <span className="toy-tile__media">
        {category.imagePath ? (
          <Image src={category.imagePath} alt="" fill sizes="(min-width: 880px) 17vw, 34vw" className="object-cover" />
        ) : null}
      </span>
      <span className="toy-tile__name">{pickLang(category.name, lang)}</span>
    </Link>
  );
}

/** A shop section's title with a "View all" link at the other end of the line, leading to the section's all page. */
export function ShopSectionHeading({ children, color, viewAll }: { children: ReactNode; color?: Parameters<typeof ShopHeading>[0]["color"]; viewAll: { href: string; label: string } }) {
  return (
    <div className="shop-title-row">
      <ShopHeading color={color}>{children}</ShopHeading>
      <Link href={viewAll.href} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold tracking-[0.06em] text-(--violet) underline-offset-4 hover:underline rtl:tracking-normal">
        {viewAll.label}
        <Icon.ArrowUp size={16} className="rotate-90 rtl:-rotate-90" />
      </Link>
    </div>
  );
}

/** One sideways line of category cards on every screen size: phones swipe it, desktop uses the row's arrows. */
export function CategoryTiles({ categories, lang }: { categories: Category[]; lang: Language }) {
  return (
    <ShopCardRow lang={lang} cols={5}>
      {categories.map((category) => (
        <CategoryTile key={category.id} category={category} lang={lang} />
      ))}
    </ShopCardRow>
  );
}

/** The all categories page: the same cards as the shop row, laid out as a grid (2 across on phones, up to 5 on desktop). */
export function CategoryGrid({ categories, lang, label }: { categories: Category[]; lang: Language; label: string }) {
  return (
    <ul aria-label={label} className="m-0 [display:grid] list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
      {categories.map((category) => (
        <li key={category.id} className="min-w-0">
          <CategoryTile category={category} lang={lang} />
        </li>
      ))}
    </ul>
  );
}

/** One brand plate: its logo (or first letter), then its name. Shared by the shop page's row and the all brands page's grid. */
function BrandTile({ brand, lang, index }: { brand: ProductAttribute; lang: Language; index: number }) {
  const name = pickLang(brand.name, lang);
  const imagePath = brand.imagePath ? resolveMediaUrl(brand.imagePath) : "";
  return (
    <Link href={`/${lang}/brands/${brand.slug}`} className={`toy-plate toy-plate--${PLATE_COLORS[index % PLATE_COLORS.length]}`}>
      <span className="toy-plate__media">
        {imagePath ? (
          <Image src={imagePath} alt="" fill sizes="(min-width: 1024px) 10vw, 26vw" className="object-contain" />
        ) : (
          <span aria-hidden="true" className="toy-initial">{name.charAt(0)}</span>
        )}
      </span>
      <span className="toy-label">{name}</span>
    </Link>
  );
}

export function BrandTiles({ brands, lang }: { brands: ProductAttribute[]; lang: Language }) {
  return (
    <ShopCardRow lang={lang} cols={3}>
      {brands.map((brand, index) => (
        <BrandTile key={brand.id} brand={brand} lang={lang} index={index} />
      ))}
    </ShopCardRow>
  );
}

/** The all brands page: the same plates as the shop row, each a fixed small circle (104px, 140px from tablets up); a line fits as many as the screen allows, down to one on a very narrow screen. */
export function BrandGrid({ brands, lang, label }: { brands: ProductAttribute[]; lang: Language; label: string }) {
  return (
    <ul aria-label={label} className="m-0 [display:grid] list-none grid-cols-[repeat(auto-fill,104px)] gap-4 p-0 sm:grid-cols-[repeat(auto-fill,140px)] lg:gap-6">
      {brands.map((brand, index) => (
        <li key={brand.id} className="min-w-0">
          <BrandTile brand={brand} lang={lang} index={index} />
        </li>
      ))}
    </ul>
  );
}

/** The top of the shop page: every gender as a wide picture banner. The picture carries the design, so the name is its label for screen readers. */
export function GenderTiles({ genders, lang, label, className = "" }: { genders: ProductAttribute[]; lang: Language; label: string; className?: string }) {
  return (
    <nav id="genders" aria-label={label} className={`mb-6 scroll-mt-28 ${className}`}>
      {/* Three to a row on every screen size, sharing the width, so nothing scrolls sideways. */}
      <ul className="m-0 [display:grid] list-none grid-cols-3 gap-2 p-0 sm:gap-4">
        {genders.map((gender) => {
          // A gender saved before it had an Arabic picture keeps showing its one picture.
          const picture = lang === "ar" ? gender.arImagePath || gender.imagePath : gender.imagePath;
          return (
            <li key={gender.id} className="min-w-0">
              <Link href={`/${lang}/genders/${gender.slug}`} className="gender-tile">
                {picture ? (
                  <Image src={picture} alt={pickLang(gender.name, lang)} fill sizes="33vw" className="object-cover" />
                ) : (
                  <span className="gender-tile__name">{pickLang(gender.name, lang)}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
