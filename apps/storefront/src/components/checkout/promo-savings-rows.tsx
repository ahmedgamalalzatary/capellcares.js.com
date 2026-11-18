import { formatPrice, type Dict, type Language, type PromoAppliedDto } from "@capella/shared";
import { fillTemplate } from "@/lib/promo/promo-code";

/** The subtotal before the code with the code's rows under it, so the rows add up to the total charged:
 * subtotal (sale prices) + sale prices the code replaced - the code's saving = products total. */
export function PromoSavingsRows({ lang, dict, subtotal, productsTotal, applied, rowClassName }: {
  lang: Language;
  dict: Dict;
  /** The cart at catalog prices, shown when no code applies. */
  subtotal: number;
  productsTotal: number;
  applied: PromoAppliedDto | null;
  rowClassName: string;
}) {
  const shownSubtotal = applied ? productsTotal + applied.discount - applied.saleGivenUp : subtotal;
  return (
    <>
      <div className={rowClassName}>
        <span className="text-(--ink-2)">{dict.common.subtotal}</span>
        <span className="text-ink">{formatPrice(shownSubtotal, lang)}</span>
      </div>
      {applied && applied.saleGivenUp > 0 ? (
        <div className={rowClassName}>
          <span className="text-(--ink-2)">{dict.promo.saleGivenUpLine}</span>
          <span className="text-ink">+ {formatPrice(applied.saleGivenUp, lang)}</span>
        </div>
      ) : null}
      {applied && applied.discount > 0 ? (
        <div className={rowClassName}>
          <span className="text-(--ink-2)">{fillTemplate(dict.promo.discountLine, { code: applied.code })}</span>
          <span className="text-(--success)">- {formatPrice(applied.discount, lang)}</span>
        </div>
      ) : null}
      {applied?.gift ? (
        <div className={rowClassName}>
          <span className="text-(--ink-2)">{fillTemplate(dict.promo.giftLine, { name: lang === "ar" ? applied.gift.nameAr : applied.gift.nameEn, qty: applied.gift.qty })}</span>
          <span className="text-(--success)">{dict.promo.free}</span>
        </div>
      ) : null}
      {applied?.giftUnavailable ? <p className="m-0 text-xs text-(--ink-3)">{dict.promo.giftOutOfStock}</p> : null}
    </>
  );
}
