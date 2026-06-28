import Image from "next/image";
import { pickLang, type Collection, type Language } from "@capella/shared";

export function CollectionIllustration({
  collection,
  lang = "en",
  className = ""
}: {
  collection: Pick<Collection, "name" | "imagePath" | "slug">;
  lang?: Language;
  className?: string;
}) {
  if (collection.imagePath) {
    return (
      <Image
        src={collection.imagePath}
        alt={pickLang(collection.name, lang)}
        className={className || "h-full w-full object-cover"}
        width={800}
        height={1000}
        sizes="(min-width: 1024px) 22vw, (min-width: 640px) 34vw, 78vw"
      />
    );
  }

  return (
    <div className={`grid h-full w-full place-items-center bg-[radial-gradient(circle,var(--warm-soft),var(--surface))] ${className}`}>
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.16em] text-(--ink-3)">Collection</div>
        <div className="mt-2 px-4 text-sm font-semibold text-ink">{pickLang(collection.name, lang)}</div>
      </div>
    </div>
  );
}
