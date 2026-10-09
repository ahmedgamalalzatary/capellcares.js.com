import { API_BASE } from "@/lib/api/client";

/** Accepted image MIME types for every ERP upload control. */
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
/** Accepted video MIME types. */
export const VIDEO_ACCEPT = "video/mp4,video/webm";
/** Client-side image size cap: 4 MB. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Returns the Arabic validation message for an image file, or null when it is acceptable. */
export function validateImageFile(file: File): string | null {
  if (!IMAGE_ACCEPT.split(",").includes(file.type)) {
    return "نوع الصورة غير مدعوم. استخدمي PNG أو JPG أو WEBP.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "حجم الصورة أكبر من 4 ميجابايت.";
  }
  return null;
}

/** Stored media may be a relative `/uploads/...` path, which resolves against the API origin. */
export function resolveMediaSrc(value: string): string {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/uploads/")) return `${API_BASE}${value}`;
  return value;
}
