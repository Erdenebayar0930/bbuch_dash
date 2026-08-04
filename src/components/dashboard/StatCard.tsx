import { ArrowDownRight, ArrowUpRight } from "lucide-react";

type Tone = "accent" | "neutral" | "success";

type StatCardProps = {
  label: string;
  value: string;
  /** Өмнөх үетэй харьцуулсан өөрчлөлт, ж нь "+12.4%" */
  delta?: string;
  /** Утга өссөн эсэх — сумны чиглэлийг тодорхойлно */
  deltaUp?: boolean;
  /** Өөрчлөлт таатай эсэх — өнгийг тодорхойлно (өгөөгүй бол `deltaUp`) */
  deltaPositive?: boolean;
  deltaLabel?: string;
  tone?: Tone;
};

const toneClass: Record<Tone, string> = {
  accent: "text-accent-600 dark:text-accent-400",
  neutral: "text-gray-900 dark:text-white",
  success: "text-success-500 dark:text-success-400",
};

export default function StatCard({
  label,
  value,
  delta,
  deltaUp = true,
  deltaPositive,
  deltaLabel = "өнгөрсөн үеэс",
  tone = "neutral",
}: StatCardProps) {
  const DeltaIcon = deltaUp ? ArrowUpRight : ArrowDownRight;
  const isGood = deltaPositive ?? deltaUp;

  return (
    <div className="surface p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
        {label}
      </p>

      <p className={`num mt-3 text-3xl font-semibold ${toneClass[tone]}`}>
        {value}
      </p>

      {delta && (
        <p
          className={`mt-3 flex items-center gap-1 text-theme-xs font-medium ${
            isGood
              ? "text-success-600 dark:text-success-400"
              : "text-error-500 dark:text-error-400"
          }`}
        >
          <DeltaIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
          <span className="num">{delta}</span>
          <span className="font-normal text-gray-500 dark:text-gray-400">
            {deltaLabel}
          </span>
        </p>
      )}
    </div>
  );
}
