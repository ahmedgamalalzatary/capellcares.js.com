import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { pickLang, type Category, type Language, type ProductAttribute } from "@capella/shared";
import { ShopCardRow } from "@/components/shop/shop-card-row";

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

/** The top of the shop page: every gender as a wide picture banner. The picture carries the design, so the name is its label for screen readers. */
export function GenderTiles({ genders, lang, label }: { genders: ProductAttribute[]; lang: Language; label: string }) {
  return (
    <nav aria-label={label} className="mb-6">
      <ul className="m-0 [display:grid] list-none grid-cols-2 gap-3 p-0 sm:gap-4 lg:grid-cols-3">
        {genders.map((gender) => (
          <li key={gender.id} className="min-w-0">
            <Link href={`/${lang}/genders/${gender.slug}`} className="gender-tile">
              {gender.imagePath ? (
                <Image src={gender.imagePath} alt={pickLang(gender.name, lang)} fill sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover" />
              ) : (
                <span className="gender-tile__name">{pickLang(gender.name, lang)}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
