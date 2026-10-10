// Date helpers working with *local* calendar dates as YYYY-MM-DD strings.
// Using plain strings avoids timezone drift when records are compared by day.

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local datetime string suitable for <input type="datetime-local">: YYYY-MM-DDTHH:mm */
export function toLocalDateTime(d: Date): string {
  return `${toDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nowLocal(): string {
  return toLocalDateTime(new Date());
}

export function today(): string {
  return toDateKey(new Date());
}

/** Extract the calendar day of a stored dateTime / date string. */
export function dayOf(dateTime: string): string {
  return dateTime.slice(0, 10);
}

/** Parse YYYY-MM-DD as a local date at noon (DST-safe arithmetic). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function parseLocalDateTime(s: string): Date {
  const [date, time = '12:00'] = s.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0);
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDateKey(b).getTime() - parseDateKey(a).getTime()) / 86400000);
}

/** Monday-based week start for a date key. */
export function weekStart(key: string): string {
  const d = parseDateKey(key);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  return addDays(key, -dow);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

export function inRange(key: string, from: string, to: string): boolean {
  return key >= from && key <= to;
}

export function ageFromBirthDate(birthDate: string, at: string = today()): number {
  const b = parseDateKey(birthDate);
  const n = parseDateKey(at);
  let age = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) age--;
  return age;
}
