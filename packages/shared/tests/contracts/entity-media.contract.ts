import { z } from "zod";

const localizedImageContract = z.object({
  type: z.literal("image"),
  arUrl: z.string().min(1).nullable(),
  enUrl: z.string().min(1).nullable()
}).refine((media) => media.arUrl !== null || media.enUrl !== null, {
  message: "An image URL is required for at least one language"
});

const videoContract = z.object({
  type: z.literal("video"),
  url: z.string()
});

export const storefrontEntityMediaContract = z.union([
  localizedImageContract,
  videoContract
]);
