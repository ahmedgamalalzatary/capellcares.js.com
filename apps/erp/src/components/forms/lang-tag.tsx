import { cn } from "@/lib/utils";

/** Small chip naming a field's language ("ع" / "EN"). */
export function LangTag({ lang, className }: { lang: "ar" | "en"; className?: string }) {
  return (
    <span className={cn("rounded-sm bg-sand-150 px-1.5 text-xs leading-5 text-text-muted", className)}>
      {lang === "ar" ? "ع" : "EN"}
    </span>
  );
}
