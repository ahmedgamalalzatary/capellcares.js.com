import { Layers } from "lucide-react";
import type { BundleConfig } from "@/features/bundles/bundle-config";
import { getStore } from "@/lib/store";

export const collectionConfig: BundleConfig = {
  kind: "collection",
  copy: {
    form: {
      basicsTitle: "ما هي هذه المجموعة؟",
      bundleLabel: "العناصر والأسعار",
      bundleTitle: "منتجات المجموعة وسعرها",
      bundleDescription: "اختاري منتجين مختلفين على الأقل وحدّدي سعر المجموعة.",
      mediaTitle: "صور المجموعة",
      mediaDescription: "صور المجموعة والفيديو، وصورة التمرير على البطاقة.",
      relatedDescription: "منتجات أو عروض أو مجموعات تُقترح مع هذه المجموعة.",
      statusInactiveHint: "مخفية عن المتجر",
      statusActiveHint: "تظهر في المتجر",
      primaryPublish: "نشر المجموعة",
      primarySave: "حفظ المجموعة",
      bundleHeading: "منتجات المجموعة",
      bundleHeadingHint: "منتجان مختلفان على الأقل، ولا يتكرر المقاس الواحد. وكلها داخل القسم المختار أو أقسامه الفرعية.",
      bundleEmptyTitle: "لا توجد منتجات في المجموعة بعد",
      bundleEmptyHint: "اضغطي «إضافة منتج» لاختيار أول منتج في المجموعة.",
      priceLabel: "سعر المجموعة",
      priceHint: "السعر الذي يدفعه العميل للمجموعة كاملة.",
      savingsWarning: "سعر المجموعة أعلى من السعر الأصلي لمجموع المنتجات.",
      hoverDescription: "تظهر على بطاقة المجموعة عند مرور المؤشر عليها. اختيارية.",
      statusHeading: "حالة المجموعة",
      entityLabel: "مجموعة"
    },
    requirementError: {
      nameAr: "أدخلي الاسم بالعربية",
      nameEn: "أدخلي الاسم بالإنجليزية",
      categoryId: "اختاري قسمًا",
      price: "أدخلي سعر المجموعة",
      rows: "أضيفي منتجين مختلفين على الأقل",
      image: "أضيفي صورة المجموعة"
    },
    requirementLabel: { price: "سعر المجموعة", rows: "عناصر المجموعة", image: "صورة المجموعة" },
    validation: {
      price: "أدخلي سعر المجموعة",
      rowsEmpty: "",
      rowsIncomplete: "أكملي بيانات كل عنصر",
      rowsRepeated: "لا يمكن تكرار نفس المقاس داخل المجموعة",
      draftName: "أدخلي اسم المجموعة بالعربية أو الإنجليزية على الأقل"
    },
    saveError: "تعذر حفظ المجموعة. حاولي مرة أخرى."
  },
  list: {
    copy: {
      title: "المجموعات",
      description: "تشكيلات من المنتجات تُعرض مع بعضها بسعر موحّد.",
      searchPlaceholder: "ابحثي باسم المجموعة…",
      countNoun: "مجموعة",
      newLabel: "مجموعة جديدة",
      saveOrderLabel: "حفظ ترتيب المجموعات",
      forbiddenMessage: "لا تملكين صلاحية الوصول إلى المجموعات.",
      toggleOnMessage: "سيتم تفعيل هذه المجموعة لتظهر في المتجر. هل تريدين المتابعة؟",
      toggleOffMessage: "سيتم إيقاف هذه المجموعة ولن تظهر في المتجر. هل تريدين المتابعة؟",
      deleteConfirmLabel: "حذف المجموعة",
      deleteModalText: "ستُنقل المجموعة إلى المحذوفات. يمكنك استعادتها لاحقًا من قسم المحذوفات.",
      reorderSuccess: "تم حفظ ترتيب المجموعات.",
      reorderError: "تعذر حفظ ترتيب المجموعات. حاولي مرة أخرى.",
      deleteError: "تعذر حذف المجموعة. حاولي مرة أخرى.",
      toggleError: "تعذر تحديث حالة المجموعة. حاولي مرة أخرى.",
      emptyTitle: "لا توجد مجموعات تطابق البحث",
      activateNeedsCategory: ""
    },
    columns: [
      { key: "name", label: "المجموعة" },
      { key: "category", label: "القسم" },
      { key: "items", label: "عدد العناصر" },
      { key: "price", label: "السعر" },
      { key: "original", label: "السعر الأصلي" },
      { key: "status", label: "الحالة" }
    ],
    showSavings: false,
    requireCategoryToToggle: false,
    icon: Layers,
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
  rules: { minRows: 2, requireDistinctVariants: true },
  storeApi: {
    reorder: (ids) => getStore().reorderCollections({ ids }),
    softDelete: (id) => getStore().softDeleteCollection(id),
    toggleStatus: (id) => getStore().toggleCollectionStatus(id)
  },
  upsert: (bundle) => getStore().upsertCollection(bundle)
};
