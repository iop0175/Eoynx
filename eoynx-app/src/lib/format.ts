export function formatMoneyMinor(
  valueMinor: number | string | null | undefined,
  currency: string,
  minorUnit: number,
) {
  if (valueMinor === null || valueMinor === undefined) return "";
  const n = typeof valueMinor === "string" ? Number(valueMinor) : valueMinor;
  if (!Number.isFinite(n)) return "";

  const factor = Math.pow(10, minorUnit);
  const major = n / factor;

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: minorUnit,
    maximumFractionDigits: minorUnit,
  }).format(major);
}
