import { Pressable, View } from "react-native";
import { getEffectiveVariantPrice, pickLang, type Product, type ProductVariant } from "@capella/shared";
import { useLang } from "@/lib/lang";
import { spacing, radii, colors } from "@/theme";
import { UiText } from "@/components/ui/ui-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaImage } from "@/components/media/media-image";
import { PriceText } from "@/components/catalog/price-text";
import { QtyStepper } from "@/components/ui/qty-stepper";
import { RatingStars } from "@/components/ui/rating-stars";
export function ProductCard({ product, quantity = 0, onOpen, onAdd, onQuantityChange }: { product: Product; quantity?: number;
  onOpen: () => void; onAdd?: (variant: ProductVariant) => void; onQuantityChange?: (qty: number, variant: ProductVariant) => void }) {
  const { lang, dict } = useLang(); const name = pickLang(product.name, lang);
  const available = product.variants.filter(variant => variant.stock > 0);
  const pool = available.length ? available : product.variants;
  const variant = pool.reduce<ProductVariant | null>((best, item) => !best || getEffectiveVariantPrice(item) < getEffectiveVariantPrice(best) ? item : best, null);
  const image = product.media?.find(item => item.type === "image");
  return <View style={{ gap: spacing.small }}>
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={name} style={{ borderRadius: radii.large, overflow: "hidden" }}>
      <MediaImage media={image?.type === "image" ? image : undefined} uri={product.imagePath} label={name} />
    </Pressable>
    {available.length === 0 ? <Badge label={dict.common.outOfStock} /> : product.isNew ? <Badge label={dict.badges.new} />
      : product.isBestseller ? <Badge label={dict.badges.bestseller} /> : (product.offerIds?.length ?? 0) > 0 ? <Badge label={dict.badges.offer} /> : null}
    <UiText weight="bold">{name}</UiText>
    {variant && <PriceText amount={getEffectiveVariantPrice(variant)} original={variant.price} />}
    {product.rating && <RatingStars rating={product.rating.average} count={product.rating.count} />}
    {variant && quantity > 0 && onQuantityChange ? <QtyStepper value={quantity} max={variant.stock} disabled={available.length === 0}
      onChange={value => onQuantityChange(value, variant)} /> : <Button label={dict.common.addToCart} disabled={!variant || available.length === 0 || !onAdd}
        onPress={() => { if (variant && variant.stock > 0) onAdd?.(variant); }} />}
    {!variant && <UiText style={{ color: colors.ink3 }}>{dict.common.outOfStock}</UiText>}
  </View>;
}
