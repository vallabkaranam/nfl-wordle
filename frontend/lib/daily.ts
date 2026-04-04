export const PUZZLE_TIME_ZONE = "America/New_York";

export function getPuzzleDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PUZZLE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

export function getPreviousPuzzleDate(day: string) {
  const parsed = new Date(`${day}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
}

export function getWeeklyPuzzleKey(date = new Date()) {
  const localized = new Date(date.toLocaleString("en-US", { timeZone: PUZZLE_TIME_ZONE }));
  const dayNumber = (localized.getDay() + 6) % 7;
  localized.setDate(localized.getDate() - dayNumber + 3);

  const firstThursday = new Date(localized.getFullYear(), 0, 4);
  const firstDayNumber = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNumber + 3);

  const weekNumber = 1 + Math.round((localized.getTime() - firstThursday.getTime()) / 604800000);
  return `${localized.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}
