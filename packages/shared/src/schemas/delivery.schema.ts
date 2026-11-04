import { z } from "zod";

/** Dinar amount with at most three decimals (fils). */
export const filsAmountSchema = z
  .number()
  .nonnegative()
  .max(9_999_999)
  .refine((value) => Math.abs(Math.round(value * 1000) - value * 1000) < 1e-6, "At most 3 decimals");

const status = z.enum(["active", "inactive"]);
const name = z.string().trim().min(1).max(120);

export const deliveryAreaInputSchema = z.object({
  id: z.number().int().positive().optional(),
  arName: name,
  enName: name,
  fee: filsAmountSchema,
  status
});

export const deliveryGovernorateInputSchema = z.object({
  id: z.number().int().positive().optional(),
  arName: name,
  enName: name,
  status,
  areas: z.array(deliveryAreaInputSchema)
});

function hasDuplicates(values: string[]) {
  const seen = new Set(values.map((value) => value.trim().toLowerCase()));
  return seen.size !== values.length;
}

/** The whole delivery setup, saved at once; list order is the display order. Names must be unique (governorates overall, areas within their governorate). */
export const deliverySettingsPayloadSchema = z
  .object({ governorates: z.array(deliveryGovernorateInputSchema) })
  .superRefine((input, ctx) => {
    if (hasDuplicates(input.governorates.map((g) => g.arName)) || hasDuplicates(input.governorates.map((g) => g.enName))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate governorate name" });
    }
    input.governorates.forEach((governorate, index) => {
      if (hasDuplicates(governorate.areas.map((a) => a.arName)) || hasDuplicates(governorate.areas.map((a) => a.enName))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["governorates", index, "areas"], message: "Duplicate area name" });
      }
    });
  });

export type DeliveryAreaInput = z.infer<typeof deliveryAreaInputSchema>;
export type DeliveryGovernorateInput = z.infer<typeof deliveryGovernorateInputSchema>;
export type DeliverySettingsPayload = z.infer<typeof deliverySettingsPayloadSchema>;

export interface DeliveryArea extends DeliveryAreaInput {
  id: number;
  sortOrder: number;
}

export interface DeliveryGovernorate extends Omit<DeliveryGovernorateInput, "areas"> {
  id: number;
  sortOrder: number;
  areas: DeliveryArea[];
}

/** What checkout gets: only active governorates with at least one active area, no fees (the quote prices them). */
export interface CheckoutDeliveryGovernorate {
  id: number;
  arName: string;
  enName: string;
  areas: Array<{ id: number; arName: string; enName: string }>;
}
