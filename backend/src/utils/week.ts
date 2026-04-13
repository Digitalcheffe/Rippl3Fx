import db from '../db/connection';
import { getLocalDate } from './timezone';

let cachedWeekStartDay: number | null = null;

/**
 * Read the user's week_start_day preference from the DB.
 * Single-user app — cached after first read. Call clearWeekStartCache() after updates.
 */
export function getWeekStartDay(): number {
  if (cachedWeekStartDay !== null) return cachedWeekStartDay;
  const row = db.prepare('SELECT week_start_day FROM user LIMIT 1').get() as { week_start_day: number } | undefined;
  cachedWeekStartDay = row?.week_start_day ?? 1; // default Monday
  return cachedWeekStartDay;
}

/** Clear the cached week start day (call after user changes setting). */
export function clearWeekStartCache(): void {
  cachedWeekStartDay = null;
}

/**
 * Get the start of the week containing the given date, respecting
 * the user's configured week start day.
 *
 * @param dateStr - YYYY-MM-DD string (defaults to today)
 * @param weekStartDay - 0=Sun..6=Sat (defaults to user preference from DB)
 */
export function getWeekStart(dateStr?: string, weekStartDay?: number): string {
  const startDay = weekStartDay ?? getWeekStartDay();
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const currentDay = d.getDay(); // 0=Sun..6=Sat
  // Calculate how many days to subtract to reach the week start
  const diff = (currentDay - startDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  return getLocalDate(d);
}

/**
 * Get the end of the week (start + 6 days).
 */
export function getWeekEnd(weekStartDate: string): string {
  const d = new Date(weekStartDate + 'T12:00:00');
  d.setDate(d.getDate() + 6);
  return getLocalDate(d);
}

/**
 * Get the start of the previous week relative to a given date.
 */
export function getPreviousWeekStart(dateStr?: string, weekStartDay?: number): string {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  // Go back 7 days to land in previous week, then find that week's start
  d.setDate(d.getDate() - 7);
  return getWeekStart(getLocalDate(d), weekStartDay);
}
