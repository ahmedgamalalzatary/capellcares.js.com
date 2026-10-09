import { cn } from "@/lib/utils";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden className={cn("block animate-pulse rounded-md bg-sand-150", className)} style={style} />;
}

/** Placeholder for an editor page while its record loads (step header + one form card). */
export function FormSkeleton() {
  return (
    <div role="status" aria-label="جارٍ التحميل" className="grid gap-5">
      <div className="flex items-center gap-4 rounded-well bg-surface px-5 py-4 shadow-well">
        {[0, 1, 2, 3, 4].map((index) => (
          <span key={index} className="flex items-center gap-2">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-3.5 w-16 max-md:hidden" />
          </span>
        ))}
      </div>
      <div className="grid gap-5 rounded-well bg-surface p-5 shadow-well sm:p-6">
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-5 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="grid gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-10 w-full rounded-control" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
