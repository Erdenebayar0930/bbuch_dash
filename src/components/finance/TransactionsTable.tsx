import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  type Transaction,
  type TransactionStatus,
} from "@/data/finance";
import RowActions from "./RowActions";

type TransactionsTableProps = {
  items: Transaction[];
  /** Хянах самбарын хураангуй хувилбар — төрөл ба үйлдлийн багана нуугдана */
  compact?: boolean;
  onEdit?: (item: Transaction) => void;
  onDelete?: (item: Transaction) => void | Promise<void>;
  /** Хоосон үед харуулах нэмэлт үйлдэл */
  emptyAction?: ReactNode;
};

const statusLabel: Record<TransactionStatus, string> = {
  approved: "Батлагдсан",
  pending: "Хүлээгдэж буй",
  rejected: "Цуцлагдсан",
};

const statusClass: Record<TransactionStatus, string> = {
  approved:
    "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  pending:
    "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  rejected:
    "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400",
};

const headCell =
  "px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400";

export default function TransactionsTable({
  items,
  compact = false,
  onEdit,
  onDelete,
  emptyAction,
}: TransactionsTableProps) {
  const showActions = !compact && Boolean(onEdit || onDelete);

  if (items.length === 0) {
    return (
      <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 px-5 py-8 text-center">
        <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
          Гүйлгээ олдсонгүй
        </p>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Сонгосон хугацаанд бүртгэгдсэн гүйлгээ байхгүй байна.
        </p>
        {emptyAction}
      </div>
    );
  }

  return (
    <div className="max-w-full overflow-x-auto custom-scrollbar">
      <Table>
        <TableHeader className="border-y border-gray-100 dark:border-white/10">
          <TableRow>
            <TableCell isHeader className={headCell}>
              Огноо
            </TableCell>
            <TableCell isHeader className={headCell}>
              Тайлбар
            </TableCell>
            <TableCell isHeader className={headCell}>
              Ангилал
            </TableCell>
            {!compact && (
              <TableCell isHeader className={headCell}>
                Төрөл
              </TableCell>
            )}
            <TableCell isHeader className={headCell}>
              Төлөв
            </TableCell>
            <TableCell isHeader className={`${headCell} !text-right`}>
              Дүн
            </TableCell>
            {showActions && (
              <TableCell isHeader className={`${headCell} w-12`}>
                <span className="sr-only">Үйлдэл</span>
              </TableCell>
            )}
          </TableRow>
        </TableHeader>

        <TableBody className="divide-y divide-gray-100 dark:divide-white/10">
          {items.map((item) => {
            const isIncome = item.type === "income";
            const signed = isIncome ? item.amount : -item.amount;

            return (
              <TableRow
                key={item.id}
                className="transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
              >
                <TableCell className="num whitespace-nowrap px-5 py-4 text-theme-sm text-navy-700 dark:text-gray-400">
                  {item.date}
                </TableCell>

                <TableCell className="px-5 py-4 text-theme-sm font-medium text-gray-800 dark:text-white/90">
                  {item.description}
                </TableCell>

                <TableCell className="px-5 py-4">
                  <span className="inline-flex whitespace-nowrap rounded-md bg-gray-100 px-2.5 py-1 text-theme-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
                    {item.category}
                  </span>
                </TableCell>

                {!compact && (
                  <TableCell className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-theme-xs font-medium ${
                        isIncome
                          ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400"
                          : "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400"
                      }`}
                    >
                      {isIncome ? (
                        <ArrowUp className="h-3 w-3" strokeWidth={2.4} />
                      ) : (
                        <ArrowDown className="h-3 w-3" strokeWidth={2.4} />
                      )}
                      {isIncome ? "Орлого" : "Зарлага"}
                    </span>
                  </TableCell>
                )}

                <TableCell className="px-5 py-4">
                  <span
                    className={`inline-flex whitespace-nowrap rounded-md px-2.5 py-1 text-theme-xs font-medium ${
                      statusClass[item.status]
                    }`}
                  >
                    {statusLabel[item.status]}
                  </span>
                </TableCell>

                <TableCell
                  className={`num whitespace-nowrap px-5 py-4 text-right text-theme-sm font-medium ${
                    isIncome
                      ? "text-success-600 dark:text-success-400"
                      : "text-error-500 dark:text-error-400"
                  }`}
                >
                  {formatCurrency(signed, true)}
                </TableCell>

                {showActions && (
                  <TableCell className="px-3 py-4">
                    <RowActions
                      onEdit={onEdit ? () => onEdit(item) : undefined}
                      onDelete={onDelete ? () => onDelete(item) : undefined}
                    />
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
