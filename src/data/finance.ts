import type { Transaction } from "@/lib/transactions";

export type {
  Transaction,
  TransactionInput,
  TransactionStatus,
  TransactionType,
} from "@/lib/transactions";

export const monthsOfYear = Array.from({ length: 12 }, (_, index) => index + 1);

/** Маягтад санал болгох ангиллууд. */
export const incomeCategories = [
  "Борлуулалт",
  "Гэрээт ажил",
  "Түрээсийн орлого",
  "Хүүгийн орлого",
  "Бусад орлого",
];

export const expenseCategories = [
  "Цалин",
  "Бараа материал",
  "Үйл ажиллагааны зардал",
  "Маркетинг",
  "Татвар",
  "Тээвэр",
  "Бусад зардал",
];

export type Period = { year: number; month: number | null };

/**
 * Жагсаалтын хамгийн сүүлийн гүйлгээтэй үе — хэрэглэгч сонголт хийгээгүй
 * үед үзүүлэх анхны хугацаа. Хоосон бол энэ оны бүтэн жил.
 */
export function latestPeriod(list: Transaction[]): Period {
  const latest = list[0]?.date;

  if (!latest) return { year: new Date().getFullYear(), month: null };

  return {
    year: Number(latest.slice(0, 4)),
    month: Number(latest.slice(5, 7)),
  };
}

/** Өгөгдөлд байгаа онууд — хоосон үед `fallback` жилийг буцаана. */
export function yearsFrom(list: Transaction[], fallback: number): number[] {
  const years = new Set(list.map((item) => Number(item.date.slice(0, 4))));
  if (years.size === 0) years.add(fallback);
  return [...years].sort((a, b) => a - b);
}

/** Сонгосон он/сарын гүйлгээ. `month` нь null бол бүтэн жил. */
export function filterByPeriod(
  list: Transaction[],
  year: number,
  month: number | null
): Transaction[] {
  const prefix =
    month === null ? `${year}-` : `${year}-${String(month).padStart(2, "0")}-`;

  return list.filter((item) => item.date.startsWith(prefix));
}

export type Totals = {
  income: number;
  expense: number;
  net: number;
  /** Ашгийн маржин, хувиар */
  margin: number;
};

export function summarize(list: Transaction[]): Totals {
  const income = list
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const expense = list
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  const net = income - expense;

  return {
    income,
    expense,
    net,
    margin: income === 0 ? 0 : (net / income) * 100,
  };
}

/** Өмнөх үе — сар сонгосон бол өмнөх сар, эсвэл өмнөх жил. */
export function previousPeriod(
  year: number,
  month: number | null
): { year: number; month: number | null } {
  if (month === null) return { year: year - 1, month: null };
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

/** Жилийн доторх сар бүрийн дүн — өгөгдөлтэй саруудыг л буцаана. */
export function monthlyTotals(list: Transaction[], year: number) {
  return monthsOfYear
    .map((month) => ({ month, items: filterByPeriod(list, year, month) }))
    .filter((entry) => entry.items.length > 0)
    .map(({ month, items }) => ({ month, ...summarize(items) }));
}

/** Зардлын бүтэц — хамгийн том `limit` ангилал, үлдсэн нь "Бусад". */
export function expenseByCategory(list: Transaction[], limit = 5) {
  const totals = new Map<string, number>();

  for (const item of list) {
    if (item.type !== "expense") continue;
    totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount);
  }

  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, limit - 1);
  const tail = sorted.slice(limit - 1);
  const rest = tail.reduce((sum, [, value]) => sum + value, 0);

  const merged: [string, number][] =
    rest > 0 ? [...head, ["Бусад", rest]] : sorted;
  const total = sorted.reduce((sum, [, value]) => sum + value, 0);

  return merged.map(([name, value]) => ({
    name,
    value,
    share: total === 0 ? 0 : Math.round((value / total) * 100),
  }));
}

const numberFormat = new Intl.NumberFormat("mn-MN");

/** ₮12.9M хэлбэрийн товч бичиглэл. */
export function formatCompact(value: number): string {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);

  if (abs >= 1_000_000) return `${sign}₮${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}₮${Math.round(abs / 1_000)}K`;
  return `${sign}₮${numberFormat.format(abs)}`;
}

/** ₮5,100,000 — `signed` үед +/− тэмдэгтэй. */
export function formatCurrency(value: number, signed = false): string {
  const sign = value < 0 ? "−" : signed ? "+" : "";
  return `${sign}₮${numberFormat.format(Math.abs(value))}`;
}

/** Хувийн өөрчлөлт — өмнөх утга 0 бол null. */
export function percentChange(
  current: number,
  previous: number
): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatPercent(value: number, suffix = "%"): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(1)}${suffix}`;
}

export function periodLabel(year: number, month: number | null): string {
  return month === null ? `${year} он` : `${year} оны ${month}-р сар`;
}

export type BreakEvenMetrics = {
  fixedCosts: number;
  variableCostPerUnit: number;
  pricePerUnit: number;
  breakEvenUnits: number;
  breakEvenRevenue: number;
  safetyMargin: number;
  marginOfSafetyPercent: number;
};

/**
 * Хугарлын цэгийн үзүүлэлтүүдийг тооцоолно.
 * Бараа материал + Тээвэр = Хувьсах зардал, бусад = Тогтмол зардал
 */
export function calculateBreakEven(list: Transaction[]): BreakEvenMetrics {
  // Тогтмол зардал (Цалин, Үйл ажиллагааны зардал, Маркетинг, Татвар, Бусад зардал)
  const fixedExpenses = [
    "Цалин",
    "Үйл ажиллагааны зардал",
    "Маркетинг",
    "Татвар",
    "Бусад зардал",
  ];

  // Хувьсах зардал (Бараа материал, Тээвэр)
  const variableExpenses = ["Бараа материал", "Тээвэр"];

  const totalIncome = list
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const fixedCosts = list
    .filter((item) => item.type === "expense" && fixedExpenses.includes(item.category))
    .reduce((sum, item) => sum + item.amount, 0);

  const totalVariableCosts = list
    .filter((item) => item.type === "expense" && variableExpenses.includes(item.category))
    .reduce((sum, item) => sum + item.amount, 0);

  const totalExpense = list
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  // Ойролцоо нэгж (бараа борлуулалтын тоо) — орлого дээр үндэслэнэ
  const estimatedUnits = Math.max(100, Math.ceil(totalIncome / 100000));
  const pricePerUnit = totalIncome > 0 ? totalIncome / estimatedUnits : 1;
  
  // Хувьсах зардлын бүх нэгжээ хувьсак болгон ашигла
  const variableCostPerUnit = totalVariableCosts > 0 ? totalVariableCosts / estimatedUnits : 0;

  // Хугарлын цэг = Тогтмол зардал / (Нэгжийн үнэ - Нэгжийн хувьсах зардал)
  const contributionMargin = pricePerUnit - variableCostPerUnit;
  const breakEvenUnits =
    contributionMargin > 0
      ? Math.ceil(fixedCosts / contributionMargin)
      : estimatedUnits;
  const breakEvenRevenue = breakEvenUnits * pricePerUnit;

  // Аюулгүй маржин = (Одоогийн борлуулалт - Хугарлын цэг) / Одоогийн борлуулалт * 100
  const safetyMargin = totalIncome - breakEvenRevenue;
  const marginOfSafetyPercent =
    totalIncome > 0 ? (safetyMargin / totalIncome) * 100 : 0;

  return {
    fixedCosts,
    variableCostPerUnit,
    pricePerUnit,
    breakEvenUnits,
    breakEvenRevenue,
    safetyMargin,
    marginOfSafetyPercent,
  };
}

/**
 * Хугарлын цэгийн график дээр харуулах өгөгдөл — өнгөрсөн гүйлгээн дээр үндэслэнэ
 */
export function generateBreakEvenChartData(
  metrics: BreakEvenMetrics,
  transactionList?: Transaction[]
): { units: number[]; revenue: number[]; fixedCosts: number[]; variableCosts: number[] } {
  const units: number[] = [];
  const revenue: number[] = [];
  const fixedCosts: number[] = [];
  const variableCosts: number[] = [];

  // Хэрэв гүйлгээний мэдээлэл өгөгдсөн бол түүнээс орлого/зардлыг авна
  if (transactionList && transactionList.length > 0) {
    const totalIncome = transactionList
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + item.amount, 0);

    const totalExpense = transactionList
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + item.amount, 0);

    // Өнгөрсөн гүйлгээгээс ойролцоо нэгжийг тодорхойлно
    const estimatedUnits = Math.max(100, Math.ceil(totalIncome / 100000));
    const pricePerUnit = totalIncome > 0 ? totalIncome / estimatedUnits : 0;
    const variableCostPerUnit = totalExpense > 0 ? (totalExpense * 0.4) / estimatedUnits : 0;

    // 0 нэгжээс 150% хугарлын цэгийнхээ нэгжээ хүртэл
    const maxUnits = Math.ceil(estimatedUnits * 1.5);
    const step = Math.max(1, Math.ceil(maxUnits / 20));

    for (let i = 0; i <= maxUnits; i += step) {
      units.push(i);
      revenue.push(i * pricePerUnit);
      fixedCosts.push(metrics.fixedCosts);
      variableCosts.push(i * variableCostPerUnit);
    }
  } else {
    // Үүнэхээ байхгүй үе: теоретик тооцоолол
    const maxUnits = Math.max(100, Math.ceil(metrics.breakEvenUnits * 1.5));
    const step = Math.max(1, Math.ceil(maxUnits / 20));

    for (let i = 0; i <= maxUnits; i += step) {
      units.push(i);
      revenue.push(i * metrics.pricePerUnit);
      fixedCosts.push(metrics.fixedCosts);
      variableCosts.push(i * metrics.variableCostPerUnit);
    }
  }

  return { units, revenue, fixedCosts, variableCosts };
}
