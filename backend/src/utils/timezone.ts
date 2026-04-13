/**
 * Timezone utilities — all date formatting respects the TZ env var.
 * Defaults to 'UTC' if TZ is not set.
 */

export function getTimezone(): string {
  return process.env.TZ || 'UTC';
}

/** Returns YYYY-MM-DD in the configured timezone. */
export function getLocalDate(date?: Date): string {
  const d = date || new Date();
  const tz = getTimezone();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  const day = parts.find(p => p.type === 'day')!.value;
  return `${year}-${month}-${day}`;
}

/** Returns YYYY-MM-DD for yesterday in the configured timezone. */
export function getYesterdayDate(date?: Date): string {
  const d = date || new Date();
  const yesterday = new Date(d.getTime() - 86_400_000);
  return getLocalDate(yesterday);
}

/** Returns the day-of-week (0=Sun, 1=Mon, ...) in the configured timezone. */
export function getLocalDayOfWeek(date?: Date): number {
  const d = date || new Date();
  const tz = getTimezone();
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  }).format(d);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? 0;
}

/** Returns YYYY-MM-DDTHH:00 in the configured timezone (hour-level granularity for hourly metrics). */
export function getLocalHour(date?: Date): string {
  const d = date || new Date();
  const tz = getTimezone();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  const day = parts.find(p => p.type === 'day')!.value;
  const hour = parts.find(p => p.type === 'hour')!.value;
  return `${year}-${month}-${day}T${hour}:00`;
}

/** Returns { year, month } in the configured timezone. */
export function getLocalYearMonth(date?: Date): { year: number; month: number } {
  const d = date || new Date();
  const tz = getTimezone();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d);

  const year = parseInt(parts.find(p => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find(p => p.type === 'month')!.value, 10);
  return { year, month };
}
