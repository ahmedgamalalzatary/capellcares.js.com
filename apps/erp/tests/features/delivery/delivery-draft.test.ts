import { describe, expect, it } from "vitest";
import type { DeliveryGovernorate } from "@capella/shared";
import { draftError, fromSettings, newArea, newGovernorate, toPayload } from "@/features/delivery/lib/delivery-draft";

const saved: DeliveryGovernorate[] = [{
  id: 1, arName: "حولي", enName: "Hawalli", status: "active", sortOrder: 0,
  areas: [{ id: 10, arName: "السالمية", enName: "Salmiya", fee: 1.5, status: "active", sortOrder: 0 }]
}];

describe("delivery draft", () => {
  it("turns saved settings into editable rows with fees as text", () => {
    const draft = fromSettings(saved);
    expect(draft[0]).toMatchObject({ id: 1, arName: "حولي", enName: "Hawalli", status: "active" });
    expect(draft[0]!.areas[0]).toMatchObject({ id: 10, fee: "1.5" });
    expect(draft[0]!.key).toBeTruthy();
  });

  it("builds the save payload in list order, trimming names and keeping ids", () => {
    const draft = fromSettings(saved);
    draft[0]!.arName = "  حولي ";
    draft.push({ ...newGovernorate(), arName: "الجهراء", enName: "Jahra", areas: [{ ...newArea(), arName: "الجهراء", enName: "Jahra City", fee: "2.125" }] });
    expect(toPayload(draft)).toEqual({
      governorates: [
        { id: 1, arName: "حولي", enName: "Hawalli", status: "active", areas: [{ id: 10, arName: "السالمية", enName: "Salmiya", fee: 1.5, status: "active" }] },
        { arName: "الجهراء", enName: "Jahra", status: "active", areas: [{ arName: "الجهراء", enName: "Jahra City", fee: 2.125, status: "active" }] }
      ]
    });
  });

  it("is valid when every name and fee is filled", () => {
    expect(draftError(fromSettings(saved))).toBeNull();
    expect(draftError([])).toBeNull();
  });

  it("asks for both names on governorates and areas", () => {
    expect(draftError([{ ...newGovernorate(), enName: "X" }])).toMatch(/اسم/);
    const draft = fromSettings(saved);
    draft[0]!.areas[0]!.enName = " ";
    expect(draftError(draft)).toMatch(/اسم/);
  });

  it("asks for a valid fee with at most 3 decimals", () => {
    for (const fee of ["", "-1", "abc", "1.0005"]) {
      const draft = fromSettings(saved);
      draft[0]!.areas[0]!.fee = fee;
      expect(draftError(draft), fee).toMatch(/رسوم/);
    }
  });

  it("refuses duplicate names", () => {
    const twice = [...fromSettings(saved), ...fromSettings(saved).map((g) => ({ ...g, id: undefined }))];
    expect(draftError(twice)).toMatch(/مكرر/);
    const draft = fromSettings(saved);
    draft[0]!.areas.push({ ...newArea(), arName: "السالمية", enName: "Other", fee: "1" });
    expect(draftError(draft)).toMatch(/مكرر/);
  });
});
