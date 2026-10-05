import { useState } from "react";
import { Platform, View } from "react-native";
import { Redirect } from "expo-router";
import type { Product, AppUpdateRequired } from "@capella/shared";
import { useLang } from "@/lib/lang";
import { Screen, SectionHeader, UiText, Button, Input, QtyStepper, PriceText, RatingStars, Badge,
  ChoiceGroup, EmptyState, ErrorState, ConfirmDialog, MediaGallery, ProductCard, UpdateNotice, FeatureUpdateRequired } from "@/components";
import { spacing } from "@/theme";

// A development-only component gallery. These fixtures are labelled samples;
// they do not call checkout/auth/cart mutations or claim business success.
const sample: Product = { id: 1, sku: "preview", slug: "sample", name: { ar: "عنصر توضيحي", en: "Sample item" },
  description: { ar: "", en: "" }, ingredients: { ar: "", en: "" }, howToUse: { ar: "", en: "" }, warnings: { ar: "", en: "" },
  keywords: [], buyingPrice: 0, imagePath: "", status: "active", isNew: true, isBestseller: false, categoryId: 1,
  variants: [{ id: 1, productId: 1, size: "Sample", price: 100, stock: 3 }], createdAt: "", updatedAt: "" };
function GalleryPreview() {
  const { lang, dict, setLang } = useLang(); const ar = lang === "ar";
  const [quantity, setQuantity] = useState(1), [selection, setSelection] = useState("featured"), [email, setEmail] = useState("");
  const [dialog, setDialog] = useState(false), [notice, setNotice] = useState(true), [error, setError] = useState(true);
  const origin = Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : "";
  const requirement: AppUpdateRequired = { code: "APP_UPDATE_REQUIRED", feature: "checkout", policyRevision: "sample", requiredRelease: "sample",
    message: "Sample", explanation: { ar: "مثال: تتطلب هذه الميزة إصدارًا أحدث. تبقى بقية المهام متاحة.", en: "Sample: this feature needs a newer version. Other tasks stay available." },
    storeUrl: "https://play.google.com/store/apps/details?id=com.capellacare.app" };
  return <Screen>
    <SectionHeader title={ar ? "معاينة المكونات" : "Component preview"}
      description={ar ? "أمثلة للتطوير فقط؛ ليست منتجات أو طلبات حقيقية." : "Development samples; these are not real products or orders."} />
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.small }}>
      <Button label="العربية" variant="outline" selected={ar} onPress={() => setLang("ar")} />
      <Button label="English" variant="outline" selected={!ar} onPress={() => setLang("en")} />
    </View>
    <SectionHeader title={ar ? "الأزرار والنماذج" : "Buttons and forms"} />
    <Button label={ar ? "متابعة" : "Continue"} onPress={() => {}} />
    <Button label={ar ? "غير متاح" : "Unavailable"} disabled onPress={() => {}} />
    <Input label={ar ? "البريد الإلكتروني" : "Email"} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
      error={email && !email.includes("@") ? (ar ? "أدخل بريدًا إلكترونيًا صالحًا" : "Enter a valid email") : undefined} />
    <QtyStepper value={quantity} max={3} onChange={setQuantity} />
    <PriceText amount={90} original={100} /><RatingStars rating={4.5} count={8} /><Badge label={dict.badges.new} />
    <ChoiceGroup label={dict.common.sort} value={selection} options={[{ value: "featured", label: dict.filters.sortFeatured },
      { value: "price", label: dict.filters.sortPriceAsc }]} onChange={setSelection} />
    <SectionHeader title={ar ? "بطاقة توضيحية" : "Sample card"} />
    <View style={{ width: "100%", maxWidth: 320, alignSelf: "center" }}><ProductCard product={{ ...sample, imagePath: `${origin}/brand-preview.jpg` }}
      quantity={quantity} onOpen={() => setDialog(true)} onQuantityChange={setQuantity} /></View>
    <SectionHeader title={ar ? "الوسائط" : "Media"} />
    <MediaGallery label={ar ? "شعار كابيلا" : "Capella logo"} media={[{ type: "image", arUrl: `${origin}/brand-preview.jpg`, enUrl: `${origin}/brand-preview.jpg` },
      { type: "image", arUrl: `${origin}/brand-preview.jpg?second`, enUrl: `${origin}/brand-preview.jpg?second` }]} />
    <SectionHeader title={ar ? "حالات الاسترداد والتحديث" : "Recovery and updates"} />
    {notice && <UpdateNotice title={ar ? "مثال لتحديث اختياري" : "Sample optional update"} explanation={requirement.explanation}
      storeUrl={requirement.storeUrl} onDismiss={async () => setNotice(false)} />}
    <FeatureUpdateRequired requirement={requirement} />
    <EmptyState title={dict.common.empty} description={dict.filters.emptyDesc} />
    {error && <ErrorState message={ar ? "مثال: تعذر تحميل البيانات" : "Sample: couldn't load data"} onRetry={() => setError(false)} />}
    <Button label={ar ? "فتح التأكيد" : "Open confirmation"} variant="outline" onPress={() => setDialog(true)} />
    <ConfirmDialog visible={dialog} title={ar ? "تأكيد توضيحي" : "Sample confirmation"} message={ar ? "هذا إجراء توضيحي فقط." : "This is a sample action only."}
      confirmLabel={dict.common.confirm} onConfirm={() => setDialog(false)} onCancel={() => setDialog(false)} />
    <UiText>{ar ? "ما زالت بقية المهام متاحة." : "Other tasks remain available."}</UiText>
  </Screen>;
}
export default function ComponentPreview() { return __DEV__ ? <GalleryPreview /> : <Redirect href="/" />; }
