import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { pickLang, type Category, type Language, type ProductAttribute } from "@capella/shared";
import { resolveMediaUrl } from "@/lib/api/client/normalizers";
import { ShopCardRow } from "@/components/shop/shop-card-row";

/** Brand plates take these in turn, so neighbours never match. */
const PLATE_COLORS = ["violet", "magenta", "blue", "cyan", "sunny"] as const;

export function ShopHeading({ children, color = "violet" }: { children: ReactNode; color?: "violet" | "magenta" | "blue" | "cyan" | "sunny" }) {
  return (
    <h2 className={`shop-title shop-title--${color}`}>
      <span>{children}</span>
    </h2>
  );
}

/** Two cards per row on phones and tablets, one sideways line on desktop. */
export function CategoryTiles({ categories, lang }: { categories: Category[]; lang: Language }) {
  return (
    <ShopCardRow lang={lang} gridOnMobile>
      {categories.map((category) => (
        <Link key={category.id} href={`/${lang}/category/${category.slug}?categoryId=${category.id}`} className="toy-tile">
          <span className="toy-tile__media">
            {category.imagePath ? (
              <Image src={category.imagePath} alt="" fill sizes="(min-width: 880px) 20vw, 50vw" className="object-cover" />
            ) : null}
          </span>
          <span className="toy-tile__name">{pickLang(category.name, lang)}</span>
        </Link>
      ))}
    </ShopCardRow>
  );
}

export function BrandTiles({ brands, lang }: { brands: ProductAttribute[]; lang: Language }) {
  return (
    <ShopCardRow lang={lang} cols={3}>
      {brands.map((brand, index) => {
        const name = pickLang(brand.name, lang);
        const imagePath = brand.imagePath ? resolveMediaUrl(brand.imagePath) : "";
        return (
          <Link key={brand.id} href={`/${lang}/brands/${brand.slug}`} className={`toy-plate toy-plate--${PLATE_COLORS[index % PLATE_COLORS.length]}`}>
            <span className="toy-plate__media">
              {imagePath ? (
                <Image src={imagePath} alt="" fill sizes="(min-width: 1024px) 16vw, 42vw" className="object-contain" />
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

/** The top of the shop page: every gender as a wide picture banner. The picture carries the design, so the name is its label for screen readers. */
export function GenderTiles({ genders, lang, label, className = "" }: { genders: ProductAttribute[]; lang: Language; label: string; className?: string }) {
  return (
    <nav id="genders" aria-label={label} className={`mb-6 scroll-mt-28 ${className}`}>
      {/* Phones: every gender on one line, sharing the width, so nothing scrolls sideways. */}
      <ul className="m-0 [display:grid] list-none grid-cols-2 gap-3 p-0 max-[879px]:grid-flow-col max-[879px]:auto-cols-fr max-[879px]:grid-cols-none max-[879px]:gap-2 sm:gap-4 lg:grid-cols-3">
        {genders.map((gender) => {
          // A gender saved before it had an Arabic picture keeps showing its one picture.
          const picture = lang === "ar" ? gender.arImagePath || gender.imagePath : gender.imagePath;
          return (
            <li key={gender.id} className="min-w-0">
              <Link href={`/${lang}/genders/${gender.slug}`} className="gender-tile">
                {picture ? (
                  <Image src={picture} alt={pickLang(gender.name, lang)} fill sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover" />
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
