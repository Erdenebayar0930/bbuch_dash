type CardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
};

export default function Card({ title, value, subtitle }: CardProps) {
  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {title}
      </p>

      <h3 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
        {value}
      </h3>

      {subtitle && (
        <span className="mt-1 block text-xs text-gray-400">
          {subtitle}
        </span>
      )}
    </div>
  );
}
