// src/lib/timezones.ts
import { format, toZonedTime } from 'date-fns-tz';

const zones = Intl.supportedValuesOf('timeZone');
const now = new Date();

export const timeZones = zones.map(tz => {
    try {
        const zonedDate = toZonedTime(now, tz);
        const offset = format(zonedDate, 'z', { timeZone: tz });
        return `(${offset}) ${tz}`;
    } catch (error) {
        console.error(error);
        return tz;
    }
}).sort((a, b) => {
    const aName = a.split(') ')[1];
    const bName = b.split(') ')[1];
    return aName.localeCompare(bName);
});