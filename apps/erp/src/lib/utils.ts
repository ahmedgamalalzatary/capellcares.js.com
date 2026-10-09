import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Register the ERP's custom scale steps so merging never mistakes `text-md` for a colour.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: ["md"], radius: ["control", "well", "thumb"], shadow: ["well", "float", "inset"] },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
