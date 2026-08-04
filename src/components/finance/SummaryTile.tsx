type Tone = "income" | "expense" | "net";

type SummaryTileProps = {
  label: string;
  value: string;
  caption?: string;
  tone: Tone;
};

const toneStyles: Record<Tone, { circle: string; dot: string; value: string }> =
  {
    income: {
      circle: "bg-success-50 dark:bg-success-500/15",
      dot: "bg-success-500",
      value: "text-success-600 dark:text-success-400",
    },
    expense: {
      circle: "bg-error-50 dark:bg-error-500/15",
      dot: "bg-error-500",
      value: "text-error-500 dark:text-error-400",
    },
    net: {
      circle: "bg-accent-50 dark:bg-accent-500/15",
      dot: "bg-accent-600",
      value: "text-accent-600 dark:text-accent-400",
    },
  };

/** Гүйлгээний хуудасны дүнгийн карт — зүүн талдаа өнгөт тэмдэгтэй. */
export default function SummaryTile({
  label,
  value,
  caption,
  tone,
}: SummaryTileProps) {
  const styles = toneStyles[tone];

  return (
    <div className="surface flex items-center gap-4 p-5">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${styles.circle}`}
        aria-hidden="true"
      >
        <span className={`h-3 w-3 rounded-full ${styles.dot}`} />
      </span>

      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <p className={`num mt-1 text-2xl font-semibold ${styles.value}`}>
          {value}
        </p>
        {caption && (
          <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}
