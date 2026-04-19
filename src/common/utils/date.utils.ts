/**
 * Date utilities — operate on UTC instants only.
 *
 * Important:
 * - Do NOT apply timezone offsets here. A JS `Date` is an absolute instant (UTC).
 * - Store and compare instants in UTC (the default for Mongoose). Convert to
 *   a human-friendly timezone (e.g. America/Sao_Paulo) in the presentation layer
 *   using `Intl.DateTimeFormat` or `date-fns-tz`.
 */

// Returns the current instant (UTC). Keep the function name for compatibility
// but avoid applying any timezone offset here.
export const nowInBR = (): Date => {
  return new Date();
};

// Add months using UTC-aware arithmetic. The input `date` is treated as an
// instant; this function returns a new Date shifted by `months` months,
// using UTC month arithmetic to avoid server-local timezone effects.
export const addMonthsBR = (date: Date, months: number): Date => {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
};