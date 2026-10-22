import type { SportsMatch } from "../types";

export interface BroadcastDateWindow {
  startDate: string;
  endDate: string;
}

export function getTokyoDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addUtcDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function getBroadcastDateWindow(now: Date = new Date()): BroadcastDateWindow {
  const startDate = getTokyoDate(now);
  return { startDate, endDate: addUtcDays(startDate, 9) };
}

export function isBroadcastVisible(
  match: Pick<SportsMatch, "date" | "broadcastStatus">,
  window: BroadcastDateWindow,
): boolean {
  return match.broadcastStatus === "showing"
    && match.date >= window.startDate
    && match.date <= window.endDate;
}

export function formatBroadcastDate(date: string): string {
  return date.replaceAll("-", "/");
}
