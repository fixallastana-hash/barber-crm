import { db } from './firebase';

export function timeToMinutes(t: string): number {
  const parts = t.split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}

export function dayOfWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return days[d.getUTCDay()];
}

export const DEFAULT_TENANT_TZ = 'Asia/Almaty';

export async function getTenantTimezone(tenantId: string): Promise<string> {
  try {
    const snap = await db.doc('tenants/' + tenantId + '/config/info').get();
    const tz = snap.exists ? (snap.data()!.timezone as string | undefined) : undefined;
    if (tz && typeof tz === 'string') return tz;
  } catch {
    /* ignore */
  }
  return DEFAULT_TENANT_TZ;
}

export function nowInTenantTimezone(timezone: string): { dateStr: string; minutes: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  const minutes = parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10);
  return { dateStr, minutes };
}

export function tenantTimeToUtc(dateStr: string, minutes: number, timezone: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Сначала пробуем как UTC
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0);
  // Находим offset, который timezone имеет в этот момент
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || '0');
  const localAtGuess = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), 0, 0);
  const offset = guess - localAtGuess;
  return new Date(guess + offset);
}