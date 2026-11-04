import { filsAmountSchema, type DeliveryGovernorate, type DeliverySettingsPayload } from "@capella/shared";

export type DraftStatus = "active" | "inactive";

/** An area being edited; the fee stays text until saving so a half-typed "1." is not rewritten. */
export interface DraftArea {
  key: string;
  id?: number;
  arName: string;
  enName: string;
  fee: string;
  status: DraftStatus;
}

export interface DraftGovernorate {
  key: string;
  id?: number;
  arName: string;
  enName: string;
  status: DraftStatus;
  areas: DraftArea[];
}

const newKey = () => crypto.randomUUID();

export const newArea = (): DraftArea => ({ key: newKey(), arName: "", enName: "", fee: "", status: "active" });
export const newGovernorate = (): DraftGovernorate => ({ key: newKey(), arName: "", enName: "", status: "active", areas: [] });

export function fromSettings(settings: DeliveryGovernorate[]): DraftGovernorate[] {
  return settings.map((governorate) => ({
    key: newKey(),
    id: governorate.id,
    arName: governorate.arName,
    enName: governorate.enName,
    status: governorate.status,
    areas: governorate.areas.map((area) => ({
      key: newKey(),
      id: area.id,
      arName: area.arName,
      enName: area.enName,
      fee: String(area.fee),
      status: area.status
    }))
  }));
}

function parseFee(fee: string) {
  if (!fee.trim()) return null;
  const parsed = filsAmountSchema.safeParse(Number(fee));
  return parsed.success ? parsed.data : null;
}

const duplicated = (names: string[]) => new Set(names.map((name) => name.trim().toLowerCase())).size !== names.length;

/** The first problem to show before saving, in plain Arabic, or null when the draft can be saved. */
export function draftError(draft: DraftGovernorate[]): string | null {
  for (const governorate of draft) {
    if (!governorate.arName.trim() || !governorate.enName.trim()) return "أضيفي اسم كل محافظة بالعربية والإنجليزية.";
    for (const area of governorate.areas) {
      if (!area.arName.trim() || !area.enName.trim()) return `أضيفي اسم كل منطقة في «${governorate.arName.trim()}» بالعربية والإنجليزية.`;
      if (parseFee(area.fee) === null) return `رسوم التوصيل في «${area.arName.trim()}» يجب أن تكون رقمًا (حتى 3 خانات عشرية).`;
    }
    if (duplicated(governorate.areas.map((a) => a.arName)) || duplicated(governorate.areas.map((a) => a.enName))) {
      return `يوجد اسم منطقة مكرر في «${governorate.arName.trim()}».`;
    }
  }
  if (duplicated(draft.map((g) => g.arName)) || duplicated(draft.map((g) => g.enName))) return "يوجد اسم محافظة مكرر.";
  return null;
}

/** Call only when draftError() is null. */
export function toPayload(draft: DraftGovernorate[]): DeliverySettingsPayload {
  return {
    governorates: draft.map((governorate) => ({
      ...(governorate.id != null ? { id: governorate.id } : {}),
      arName: governorate.arName.trim(),
      enName: governorate.enName.trim(),
      status: governorate.status,
      areas: governorate.areas.map((area) => ({
        ...(area.id != null ? { id: area.id } : {}),
        arName: area.arName.trim(),
        enName: area.enName.trim(),
        fee: parseFee(area.fee) ?? 0,
        status: area.status
      }))
    }))
  };
}
