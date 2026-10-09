import { Gift } from "lucide-react";
import type { BundleConfig } from "@/features/bundles/bundle-config";
import { getStore } from "@/lib/store";

export const offerConfig: BundleConfig = {
  kind: "offer",
  copy: {
    form: {
      basicsTitle: "ما هو هذا العرض؟",
      bundleLabel: "الباقة والأسعار",
      bundleTitle: "منتجات الباقة وسعرها",
      bundleDescription: "اختاري المنتجات ومقاساتها وحدّدي سعر الباقة.",
      mediaTitle: "صور العرض",
      mediaDescription: "صور العرض والفيديو، وصورة التمرير على بطاقة العرض.",
      relatedDescription: "منتجات أو عروض أو مجموعات تُقترح مع هذا العرض.",
      statusInactiveHint: "مخفي عن المتجر",
      statusActiveHint: "يظهر في المتجر",
      primaryPublish: "نشر العرض",
      primarySave: "حفظ العرض",
      bundleHeading: "المنتجات داخل الباقة",
      bundleHeadingHint: "يجب أن ينتمي كل منتج إلى القسم المختار أو أحد أقسامه الفرعية.",
      bundleEmptyTitle: "لا توجد منتجات في الباقة بعد",
      bundleEmptyHint: "اضغطي «إضافة منتج» لاختيار أول منتج في الباقة.",
      priceLabel: "سعر الباقة",
      priceHint: "السعر الذي يدفعه العميل للباقة كاملة.",
      savingsWarning: "سعر الباقة أعلى من السعر الأصلي لمجموع المنتجات.",
      hoverDescription: "تظهر على بطاقة العرض عند مرور المؤشر عليها. اختيارية.",
      statusHeading: "حالة العرض",
      entityLabel: "عرض"
    },
    requirementError: {
      nameAr: "أدخلي الاسم بالعربية",
      nameEn: "أدخلي الاسم بالإنجليزية",
      categoryId: "اختاري قسمًا",
      price: "أدخلي سعر العرض",
      rows: "أضيفي عنصرًا صحيحًا واحدًا على الأقل",
      image: "أضيفي صورة العرض"
    },
    requirementLabel: { price: "سعر الباقة", rows: "عناصر الباقة", image: "صورة العرض" },
    validation: {
      price: "أدخلي سعرًا للعرض",
      rowsEmpty: "أضيفي منتجًا واحدًا على الأقل",
      rowsIncomplete: "أكملي بيانات كل عنصر",
      rowsRepeated: "",
      draftName: "أدخلي اسم العرض بالعربية أو الإنجليزية على الأقل"
    },
    saveError: "تعذر حفظ العرض. حاولي مرة أخرى."
  },
  list: {
    copy: {
      title: "العروض",
      description: "باقات المنتجات التي تظهر للعملاء بسعر مخفّض.",
      searchPlaceholder: "ابحثي باسم العرض…",
      countNoun: "عرض",
      newLabel: "عرض جديد",
      saveOrderLabel: "حفظ ترتيب العروض",
      forbiddenMessage: "لا تملكين صلاحية الوصول إلى العروض.",
      toggleOnMessage: "سيتم تفعيل هذا العرض ليظهر في المتجر. هل تريدين المتابعة؟",
      toggleOffMessage: "سيتم إيقاف هذا العرض ولن يظهر في المتجر. هل تريدين المتابعة؟",
      deleteConfirmLabel: "حذف العرض",
      deleteModalText: "سيُنقل العرض إلى المحذوفات. يمكنك استعادته لاحقًا من قسم المحذوفات.",
      reorderSuccess: "تم حفظ ترتيب العروض.",
      reorderError: "تعذر حفظ ترتيب العروض. حاولي مرة أخرى.",
      deleteError: "تعذر حذف العرض. حاولي مرة أخرى.",
      toggleError: "تعذر تحديث حالة العرض. حاولي مرة أخرى.",
      emptyTitle: "لا توجد عروض تطابق البحث",
      activateNeedsCategory: "اختاري قسمًا للعرض قبل تفعيله"
    },
    columns: [
      { key: "name", label: "العرض" },
      { key: "category", label: "القسم" },
      { key: "items", label: "عدد المنتجات" },
      { key: "price", label: "سعر الباقة" },
      { key: "original", label: "السعر الأصلي" },
      { key: "savings", label: "التوفير" },
      { key: "status", label: "الحالة" }
    ],
    showSavings: true,
    requireCategoryToToggle: true,
    icon: Gift,
    sortAccessors: (categories) => ({
      name: (bundle) => bundle.name.ar,
      category: (bundle) => categories.find((category) => category.id === bundle.categoryId)?.name.ar,
      items: (bundle) => bundle.items.reduce((sum, item) => sum + item.qty, 0),
      price: (bundle) => bundle.price,
      original: (bundle) => bundle.originalTotal,
      savings: (bundle) => bundle.originalTotal - bundle.price,
      status: (bundle) => (bundle.status === "active" ? 0 : 1)
    })
  },
  rules: { minRows: 1, requireDistinctVariants: false },
  storeApi: {
    reorder: (ids) => getStore().reorderOffers({ ids }),
    softDelete: (id) => getStore().softDeleteOffer(id),
    toggleStatus: (id) => getStore().toggleOfferStatus(id)
  },
  upsert: (bundle) => getStore().upsertOffer(bundle)
};
