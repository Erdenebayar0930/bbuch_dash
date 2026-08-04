import React from "react";

type PanelProps = {
  title: string;
  subtitle?: string;
  /** Гарчгийн баруун талд байрлах нэмэлт элемент (легенд, холбоос гэх мэт) */
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
};

/** Хянах самбарын нэгж хэсгийг багтаах картын хүрээ. */
export default function Panel({
  title,
  subtitle,
  action,
  className = "",
  bodyClassName = "px-5 pb-5",
  children,
}: PanelProps) {
  return (
    <div className={`surface flex flex-col ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-theme-sm text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>

      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
