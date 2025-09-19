// src/lib/utils.ts
import { toZonedTime, format } from 'date-fns-tz';

export function formatTimeInTimezone(utcDate: string, timezone: string): string {
  if (!utcDate || !timezone) {
    return 'N/A';
  }
  try {
    const zonedDate = toZonedTime(utcDate, timezone);
    return format(zonedDate, 'HH:mm', { timeZone: timezone });
  } catch (e) {
    console.error(`Erro ao formatar a data: ${e}`);
    return 'N/A';
  }
}