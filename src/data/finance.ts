const numberFormat = new Intl.NumberFormat("mn-MN");

/** ₮5,100,000 — `signed` үед +/− тэмдэгтэй. */
export function formatCurrency(value: number, signed = false): string {
  const sign = value < 0 ? "−" : signed ? "+" : "";
  return `${sign}₮${numberFormat.format(Math.abs(value))}`;
}
