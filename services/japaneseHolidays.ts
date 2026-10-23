function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, occurrence: number): number {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + (weekday - firstWeekday + 7) % 7 + (occurrence - 1) * 7;
}

function getVernalEquinoxDay(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function getAutumnalEquinoxDay(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function getJapanesePublicHolidays(year: number): Set<string> {
  const holidays = new Set([
    toDateKey(year, 1, 1),
    toDateKey(year, 1, nthWeekdayOfMonth(year, 1, 1, 2)),
    toDateKey(year, 2, 11),
    toDateKey(year, 2, 23),
    toDateKey(year, 3, getVernalEquinoxDay(year)),
    toDateKey(year, 4, 29),
    toDateKey(year, 5, 3),
    toDateKey(year, 5, 4),
    toDateKey(year, 5, 5),
    toDateKey(year, 7, nthWeekdayOfMonth(year, 7, 1, 3)),
    toDateKey(year, 8, 11),
    toDateKey(year, 9, nthWeekdayOfMonth(year, 9, 1, 3)),
    toDateKey(year, 9, getAutumnalEquinoxDay(year)),
    toDateKey(year, 10, nthWeekdayOfMonth(year, 10, 1, 2)),
    toDateKey(year, 11, 3),
    toDateKey(year, 11, 23),
  ]);

  if (year === 2019) {
    holidays.add(toDateKey(year, 5, 1));
    holidays.add(toDateKey(year, 10, 22));
  }

  // A weekday between two national holidays is also a public holiday.
  const citizenHolidayCandidate = new Date(Date.UTC(year, 0, 2));
  while (citizenHolidayCandidate.getUTCFullYear() === year) {
    const key = citizenHolidayCandidate.toISOString().slice(0, 10);
    const previous = new Date(citizenHolidayCandidate);
    previous.setUTCDate(previous.getUTCDate() - 1);
    const next = new Date(citizenHolidayCandidate);
    next.setUTCDate(next.getUTCDate() + 1);
    if (citizenHolidayCandidate.getUTCDay() !== 0
      && holidays.has(previous.toISOString().slice(0, 10))
      && holidays.has(next.toISOString().slice(0, 10))) {
      holidays.add(key);
    }
    citizenHolidayCandidate.setUTCDate(citizenHolidayCandidate.getUTCDate() + 1);
  }

  // Sunday holidays are observed on the next weekday that is not already a holiday.
  for (const holiday of Array.from(holidays)) {
    if (new Date(`${holiday}T00:00:00Z`).getUTCDay() !== 0) continue;
    const observed = new Date(`${holiday}T00:00:00Z`);
    do {
      observed.setUTCDate(observed.getUTCDate() + 1);
    } while (holidays.has(observed.toISOString().slice(0, 10)));
    holidays.add(observed.toISOString().slice(0, 10));
  }

  return holidays;
}

export function isJapanesePublicHoliday(date: string): boolean {
  const year = Number(date.slice(0, 4));
  if (!Number.isInteger(year) || year < 1980 || year > 2099) return false;
  return getJapanesePublicHolidays(year).has(date);
}

