import type { RankedItem } from "@/lib/predict";

const FILL_CLASSES = {
  coral: "bg-gradient-to-r from-brand-coralDeep to-brand-coral print:bg-brand-coral",
  teal: "bg-gradient-to-r from-brand-tealDeep to-brand-teal print:bg-brand-teal",
} as const;

const VALUE_TEXT_CLASSES = {
  coral: "text-brand-coralDeep print:text-slate-900",
  teal: "text-brand-tealDeep print:text-slate-900",
} as const;

export function BarRankingChart({
  title,
  subtitle,
  items,
  emptyMessage,
  className,
  color = "teal",
}: {
  title: string;
  subtitle: string;
  items: RankedItem[];
  emptyMessage: string;
  className?: string;
  /** Bar fill: coral highlights the featured ranking (Top 10), teal is the default. */
  color?: "coral" | "teal";
}) {
  const maxValue = items[0]?.total ?? 0;

  return (
    <div
      className={`rounded-[1.75rem] border border-brand-line bg-brand-card p-6 shadow-card print:border-slate-300 print:bg-white print:shadow-none ${className ?? ""}`}
    >
      <div>
        <h3 className="font-display text-lg font-semibold text-brand-ink print:text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-brand-muted print:text-brand-muted">{subtitle}</p>
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-brand-muted print:text-brand-muted">{emptyMessage}</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {items.map((item) => {
            const width = maxValue > 0 ? Math.max((item.total / maxValue) * 100, 6) : 0;
            return (
              <li key={item.key} className="flex items-center gap-3">
                <span
                  className="w-28 shrink-0 truncate text-sm text-brand-text sm:w-36 print:text-slate-700"
                  title={item.label}
                >
                  {item.label}
                </span>
                <div className="h-3.5 flex-1 rounded-full bg-brand-track print:bg-slate-200">
                  <div
                    className={`h-3.5 rounded-full transition-[width] ${FILL_CLASSES[color]}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span
                  className={`w-16 shrink-0 text-right text-sm font-bold tabular-nums ${VALUE_TEXT_CLASSES[color]}`}
                >
                  {item.total.toFixed(1)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
