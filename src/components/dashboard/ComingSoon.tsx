import { Construction } from "lucide-react";

type ComingSoonProps = {
  title: string;
  description?: string;
};

/** Хараахан бэлэн болоогүй хуудсуудад зориулсан хоосон төлөв. */
export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>

      <div className="surface flex min-h-[320px] flex-col items-center justify-center gap-3 p-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500">
          <Construction className="h-6 w-6" strokeWidth={1.6} />
        </span>
        <p className="text-base font-medium text-gray-800 dark:text-white/90">
          Энэ хэсэг бэлтгэгдэж байна
        </p>
        <p className="max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
          Загвар нь бэлэн боловч өгөгдөл холбогдоогүй байна. Удахгүй ашиглалтад
          орно.
        </p>
      </div>
    </div>
  );
}
