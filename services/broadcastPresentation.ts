import type { Language, SportsMatch } from "../types";

const SPORT_STYLES = [
  { names: ["soccer", "football", "サッカー"], ja: "サッカー", en: "Soccer", badgeClass: "border-emerald-400 bg-emerald-600 text-white" },
  { names: ["basketball", "バスケットボール", "バスケ", "bリーグ"], ja: "バスケットボール", en: "Basketball", badgeClass: "border-orange-400 bg-orange-600 text-white" },
  { names: ["baseball", "野球"], ja: "野球", en: "Baseball", badgeClass: "border-blue-400 bg-blue-600 text-white" },
  { names: ["rugby", "ラグビー"], ja: "ラグビー", en: "Rugby", badgeClass: "border-rose-400 bg-rose-600 text-white" },
  { names: ["horse racing", "競馬"], ja: "競馬", en: "Horse Racing", badgeClass: "border-violet-400 bg-violet-600 text-white" },
  { names: ["sports event", "スポーツイベント"], ja: "スポーツイベント", en: "Sports Event", badgeClass: "border-slate-400 bg-slate-600 text-white" },
];

export function getSportFilterValue(sport: string): string {
  const normalized = sport.normalize("NFKC").trim().toLowerCase();
  return ["soccer", "football", "サッカー"].includes(normalized) ? "association-football" : sport;
}

export function getSportPresentation(sport: string, language: Language) {
  const normalized = sport.normalize("NFKC").trim().toLowerCase();
  const config = SPORT_STYLES.find(item => item.names.includes(normalized));
  return {
    label: config ? config[language] : sport,
    badgeClass: config?.badgeClass ?? "border-slate-400 bg-slate-700 text-white",
  };
}

/** Formatting is display-only: source match strings remain canonical filter keys. */
export function formatMatchTitle(title: string): string {
  return title.replace(/vs|ｖｓ/giu, (token: string, offset: number) => {
    const before = title.slice(0, offset);
    const after = title.slice(offset + token.length);
    if (!before.trim() || !after.trim()) return token;
    // Do not split a club abbreviation such as "AVS vs Porto".
    if (/[A-Za-z]$/.test(before) && !/^[^\x00-\x7F]/u.test(after)) return token;
    return " vs ";
  }).replace(/[\t \u3000]+/gu, " ").trim();
}

export function getMatchPresentation(match: SportsMatch, language: Language) {
  const rawTitle = language === "ja" ? match.match : match.match_en;
  const timePattern = /^(.*)[(（]\s*([0-9]{1,2}[:：][0-9]{2})\s*[)）]\s*$/u;
  const localizedParts = timePattern.exec(rawTitle);
  const sourceParts = timePattern.exec(match.match);
  return {
    title: formatMatchTitle(localizedParts ? localizedParts[1] : rawTitle),
    time: (localizedParts?.[2] ?? sourceParts?.[2])?.replace("：", ":"),
  };
}

export function getMatchDateLabel(match: Pick<SportsMatch, "date" | "display_date">, language: Language): string {
  if (language === "ja") return match.display_date;
  const date = new Date(match.date + "T00:00:00Z");
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date);
  return (date.getUTCMonth() + 1) + "/" + date.getUTCDate() + " (" + weekday + ")";
}

