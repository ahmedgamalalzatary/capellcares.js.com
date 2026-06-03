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
      <img
        src={collection.imagePath}
        alt={pickLang(collection.name, lang)}
        className={className || "h-full w-full object-cover"}
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
