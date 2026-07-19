// Timetable.js
// Jízdní řád DPMB linky 8 platný od 27. 6. 2026.
// Časy jsou odjezdy ze zastávky Líšeň, Mifkova; Masarova = Mifkova + 3 min.
// Port Timetable.swift.

export const SERVICE_DAY = {
  workday: { key: 'workday', label: 'Pracovní den' },
  workdayHoliday: { key: 'workdayHoliday', label: 'Pracovní den – prázdniny' },
  weekend: { key: 'weekend', label: 'Nepracovní den (víkend / svátek)' },
};

/** Jízdní doba Mifkova → Masarova. */
export const STOP_OFFSET_MINUTES = 3;

const TZ = 'Europe/Prague';

// --- Pomocníci pro zápis časů -------------------------------------------

function times(list) {
  return list
    .map((s) => {
      const parts = s.split(':');
      if (parts.length !== 2) return null;
      const h = Number(parts[0]);
      const m = Number(parts[1]);
      if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
      return h * 60 + m;
    })
    .filter((v) => v !== null);
}

function expand(hours, minutes) {
  const out = [];
  for (const h of hours) for (const m of minutes) out.push(h * 60 + m);
  return out;
}

// --- Jízdní řády (minuty od půlnoci, odjezd z Mifkovy) -------------------

export const WORKDAY = [
  ...times(['4:54', '5:04', '5:14', '5:24', '5:34', '5:44', '5:54']),
  ...times(['6:01', '6:07', '6:13', '6:18', '6:23', '6:28', '6:33', '6:37',
            '6:41', '6:45', '6:49', '6:54', '6:58']),
  ...times(['7:01', '7:05', '7:08', '7:12', '7:16', '7:20', '7:24', '7:28',
            '7:33', '7:38', '7:43', '7:48', '7:53', '7:58']),
  ...times(['8:03', '8:08', '8:13', '8:18', '8:23', '8:29', '8:35', '8:42', '8:49', '8:55']),
  ...expand([9, 10, 11, 12, 13], [2, 9, 15, 22, 29, 35, 42, 49, 55]),
  ...times(['14:02', '14:13', '14:18', '14:23', '14:28', '14:33', '14:38', '14:43', '14:53', '14:58']),
  ...times(['15:03', '15:13', '15:18', '15:23', '15:28', '15:33', '15:38',
            '15:43', '15:48', '15:53', '15:58']),
  ...times(['16:03', '16:08', '16:13', '16:18', '16:23', '16:29', '16:35',
            '16:42', '16:49', '16:55', '16:59']),
  ...times(['17:02', '17:09', '17:15', '17:22', '17:29', '17:35', '17:42', '17:49', '17:55']),
  ...times(['18:02', '18:09', '18:16', '18:24', '18:34', '18:37', '18:44', '18:54', '18:57']),
  ...times(['19:04', '19:14', '19:24', '19:34', '19:44', '19:54']),
  ...times(['20:04', '20:14', '20:25', '20:34', '20:40', '20:55']),
  ...times(['21:10', '21:25', '21:40', '21:55', '22:10', '22:25']),
].sort((a, b) => a - b);

export const WORKDAY_HOLIDAY = [
  ...times(['4:54', '5:04', '5:14', '5:24', '5:34', '5:44', '5:54']),
  ...expand([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], [2, 9, 15, 22, 29, 35, 42, 49, 55]),
  ...times(['17:02', '17:09', '17:15', '17:22', '17:26', '17:29', '17:35', '17:42', '17:49', '17:55']),
  ...times(['18:02', '18:09', '18:16', '18:24', '18:27', '18:34', '18:44', '18:47', '18:54']),
  ...times(['19:04', '19:14', '19:24', '19:34', '19:44', '19:54']),
  ...times(['20:04', '20:14', '20:25', '20:34', '20:40', '20:55']),
  ...times(['21:10', '21:25', '21:40', '21:55', '22:10', '22:25']),
].sort((a, b) => a - b);

export const WEEKEND = [
  ...times(['5:25', '5:55', '6:25', '6:55', '7:10', '7:25', '7:40', '7:55']),
  ...times(['8:10', '8:24', '8:34', '8:44', '8:54']),
  ...expand([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19], [4, 14, 24, 34, 44, 54]),
  ...times(['19:47']),
  ...times(['20:04', '20:14', '20:25', '20:40', '20:55']),
  ...times(['21:10', '21:25', '21:40', '21:55', '22:10', '22:25']),
].sort((a, b) => a - b);

// --- Kalendář v pražském čase -------------------------------------------
// Prohlížeč na iPhonu může běžet v jiné zóně, proto se všechno počítá
// přes Intl v Europe/Prague a teprve pak převádí na absolutní čas.

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  weekday: 'short', hour12: false,
});

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Rozloží datum na složky pražského času. */
export function pragueParts(date) {
  const map = {};
  for (const p of partsFormatter.formatToParts(date)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAY_INDEX[map.weekday], // 0 = neděle
  };
}

/** Posun zóny (ms) pro daný okamžik. */
function tzOffsetMs(date) {
  const p = pragueParts(date);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - Math.floor(date.getTime() / 1000) * 1000;
}

/** Pražský lokální čas → absolutní Date. Ošetřuje i přechod letního času. */
export function pragueDate(year, month, day, minutesFromMidnight) {
  const naive = Date.UTC(year, month - 1, day, 0, minutesFromMidnight, 0);
  let guess = new Date(naive - tzOffsetMs(new Date(naive)));
  // druhá iterace kvůli hodině posunu DST
  guess = new Date(naive - tzOffsetMs(guess));
  return guess;
}

/** Velikonoční neděle (Meeus/Jones/Butcher). */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

const FIXED_HOLIDAYS = [
  [1, 1], [5, 1], [5, 8], [7, 5], [7, 6],
  [9, 28], [10, 28], [11, 17], [12, 24], [12, 25], [12, 26],
];

export function isCzechHoliday(parts) {
  const { year: y, month: m, day: d } = parts;
  if (FIXED_HOLIDAYS.some(([fm, fd]) => fm === m && fd === d)) return true;

  const easter = easterSunday(y);
  const easterUTC = Date.UTC(y, easter.month - 1, easter.day);
  for (const offset of [-2, 1]) { // Velký pátek, Velikonoční pondělí
    const x = new Date(easterUTC + offset * 86400000);
    if (x.getUTCMonth() + 1 === m && x.getUTCDate() === d) return true;
  }
  return false;
}

/** Letní prázdniny 2026 a další dny s prázdninovým provozem. */
export function isSchoolBreak(parts) {
  const { year: y, month: m, day: d } = parts;
  if ((m === 6 && d >= 29) || m === 7 || m === 8) return true;
  if (y === 2026 && ((m === 10 && (d === 29 || d === 30)) || (m === 11 && d === 16))) return true;
  return false;
}

export function serviceDay(date) {
  const p = pragueParts(date);
  if (p.weekday === 0 || p.weekday === 6 || isCzechHoliday(p)) return SERVICE_DAY.weekend;
  if (isSchoolBreak(p)) return SERVICE_DAY.workdayHoliday;
  return SERVICE_DAY.workday;
}

export function departuresFor(day) {
  switch (day.key) {
    case 'workday': return WORKDAY;
    case 'workdayHoliday': return WORKDAY_HOLIDAY;
    default: return WEEKEND;
  }
}

/** Nejbližší plánované odjezdy z Masarovy jako absolutní časy. */
export function nextScheduled(count, now = new Date()) {
  const result = [];
  const start = pragueParts(now);
  let cursorUTC = Date.UTC(start.year, start.month - 1, start.day);

  for (let dayShift = 0; dayShift < 3 && result.length < count; dayShift++) {
    const c = new Date(cursorUTC);
    const y = c.getUTCFullYear();
    const mo = c.getUTCMonth() + 1;
    const d = c.getUTCDate();

    // Poledne daného dne stačí pro rozhodnutí o typu provozu.
    const probe = pragueDate(y, mo, d, 12 * 60);
    const day = serviceDay(probe);

    for (const mifkova of departuresFor(day)) {
      const dep = pragueDate(y, mo, d, mifkova + STOP_OFFSET_MINUTES);
      if (dep > now) result.push(dep);
      if (result.length >= count) break;
    }
    cursorUTC += 86400000;
  }
  return result;
}

/** HH:mm v pražském čase. */
export function clockText(date) {
  const p = pragueParts(date);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** Je datum jiný pražský den než reference? */
export function isOtherDay(date, reference) {
  const a = pragueParts(date);
  const b = pragueParts(reference);
  return a.year !== b.year || a.month !== b.month || a.day !== b.day;
}
