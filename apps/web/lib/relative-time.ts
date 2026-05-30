// "3 minutes ago" / "in 2 days" style formatting via Intl. Pure and
// dependency-free so it's safe to call from server or client. Pass a Date,
// ISO string, or epoch ms; `now` is injectable for deterministic tests.

const DIVISIONS: ReadonlyArray<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeTime(
  value: Date | string | number,
  now: Date | number = Date.now(),
): string {
  const then = value instanceof Date ? value.getTime() : new Date(value).getTime();
  const nowMs = now instanceof Date ? now.getTime() : now;
  if (Number.isNaN(then)) return "";

  let duration = (then - nowMs) / 1000; // seconds, signed (past = negative)
  for (const { amount, unit } of DIVISIONS) {
    if (Math.abs(duration) < amount) {
      return rtf.format(Math.round(duration), unit);
    }
    duration /= amount;
  }
  return "";
}
