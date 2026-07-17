export const PAYMENT_METHODS = {
  cod: "cod"
} as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export const GOVERNORATES = [
  "Cairo",
  "Giza",
  "Alexandria",
  "Qalyubia",
  "Dakahlia",
  "Sharqia",
  "Gharbia",
  "Monufia",
  "Beheira",
  "Kafr El Sheikh",
  "Damietta",
  "Port Said",
  "Ismailia",
  "Suez",
  "North Sinai",
  "South Sinai",
  "Faiyum",
  "Beni Suef",
  "Minya",
  "Asyut",
  "Sohag",
  "Qena",
  "Luxor",
  "Aswan",
  "Red Sea",
  "New Valley",
  "Matruh"
] as const;
export type Governorate = (typeof GOVERNORATES)[number];

/** Display names per language; the English value doubles as the API enum value. */
export const GOVERNORATE_LABELS: Record<Governorate, { ar: string; en: string }> = {
  "Cairo": { ar: "القاهرة", en: "Cairo" },
  "Giza": { ar: "الجيزة", en: "Giza" },
  "Alexandria": { ar: "الإسكندرية", en: "Alexandria" },
  "Qalyubia": { ar: "القليوبية", en: "Qalyubia" },
  "Dakahlia": { ar: "الدقهلية", en: "Dakahlia" },
  "Sharqia": { ar: "الشرقية", en: "Sharqia" },
  "Gharbia": { ar: "الغربية", en: "Gharbia" },
  "Monufia": { ar: "المنوفية", en: "Monufia" },
  "Beheira": { ar: "البحيرة", en: "Beheira" },
  "Kafr El Sheikh": { ar: "كفر الشيخ", en: "Kafr El Sheikh" },
  "Damietta": { ar: "دمياط", en: "Damietta" },
  "Port Said": { ar: "بورسعيد", en: "Port Said" },
  "Ismailia": { ar: "الإسماعيلية", en: "Ismailia" },
  "Suez": { ar: "السويس", en: "Suez" },
  "North Sinai": { ar: "شمال سيناء", en: "North Sinai" },
  "South Sinai": { ar: "جنوب سيناء", en: "South Sinai" },
  "Faiyum": { ar: "الفيوم", en: "Faiyum" },
  "Beni Suef": { ar: "بني سويف", en: "Beni Suef" },
  "Minya": { ar: "المنيا", en: "Minya" },
  "Asyut": { ar: "أسيوط", en: "Asyut" },
  "Sohag": { ar: "سوهاج", en: "Sohag" },
  "Qena": { ar: "قنا", en: "Qena" },
  "Luxor": { ar: "الأقصر", en: "Luxor" },
  "Aswan": { ar: "أسوان", en: "Aswan" },
  "Red Sea": { ar: "البحر الأحمر", en: "Red Sea" },
  "New Valley": { ar: "الوادي الجديد", en: "New Valley" },
  "Matruh": { ar: "مطروح", en: "Matruh" }
};

export const EG_PHONE_REGEX = /^(?:\+20|0020|0)?1[0125]\d{8}$/;
