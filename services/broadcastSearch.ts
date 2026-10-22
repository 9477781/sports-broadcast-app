import type { Language, SportsMatch, StoreData } from "../types";

export const GEO_EN_LABELS: Record<string, string> = {
  "北海道": "Hokkaido", "東北": "Tohoku", "関東": "Kanto", "中部": "Chubu", "関西": "Kansai", "近畿": "Kansai", "中国": "Chugoku", "四国": "Shikoku", "九州": "Kyushu",
  "未登録": "Unspecified",
  "青森県": "Aomori", "岩手県": "Iwate", "宮城県": "Miyagi", "秋田県": "Akita", "山形県": "Yamagata", "福島県": "Fukushima",
  "茨城県": "Ibaraki", "栃木県": "Tochigi", "群馬県": "Gunma", "埼玉県": "Saitama", "千葉県": "Chiba", "東京都": "Tokyo", "神奈川県": "Kanagawa",
  "新潟県": "Niigata", "富山県": "Toyama", "石川県": "Ishikawa", "福井県": "Fukui", "山梨県": "Yamanashi", "長野県": "Nagano", "岐阜県": "Gifu", "静岡県": "Shizuoka", "愛知県": "Aichi",
  "三重県": "Mie", "滋賀県": "Shiga", "京都府": "Kyoto", "大阪府": "Osaka", "兵庫県": "Hyogo", "奈良県": "Nara", "和歌山県": "Wakayama",
  "鳥取県": "Tottori", "島根県": "Shimane", "岡山県": "Okayama", "広島県": "Hiroshima", "山口県": "Yamaguchi", "徳島県": "Tokushima", "香川県": "Kagawa", "愛媛県": "Ehime", "高知県": "Kochi",
  "福岡県": "Fukuoka", "佐賀県": "Saga", "長崎県": "Nagasaki", "熊本県": "Kumamoto", "大分県": "Oita", "宮崎県": "Miyazaki", "鹿児島県": "Kagoshima", "沖縄県": "Okinawa",
};

const SPORT_ALIASES = [
  ["サッカー", "soccer"],
  ["野球", "baseball"],
  ["バスケ", "バスケットボール", "basketball"],
  ["ラグビー", "rugby"],
  ["競馬", "horse racing"],
];

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/_/gu, " ").replace(/\s+/gu, " ").trim();
}

export function geoDisplayLabel(value: string, language: Language): string {
  if (language === "ja" && value === "関西") return "近畿";
  return language === "en" ? GEO_EN_LABELS[value] ?? value : value;
}

function geoSearchTerms(value: string): string[] {
  const terms = [value, GEO_EN_LABELS[value] ?? ""];
  if (value === "関西" || value === "近畿") terms.push("関西", "近畿", "Kansai");
  return terms;
}

function storeSearchText(store: StoreData): string {
  return normalizeSearchText([
    store.name,
    store.name_en,
    store.address,
    ...geoSearchTerms(store.region),
    store.prefecture,
    store.prefecture_en,
    ...geoSearchTerms(store.prefecture),
    store.city,
    ...geoSearchTerms(store.city),
  ].join(" "));
}

function eventSearchText(match: SportsMatch): string {
  const sport = normalizeSearchText(match.sport);
  const sportTerms = [match.sport];
  for (const aliases of SPORT_ALIASES) {
    if (aliases.some(alias => sport.includes(normalizeSearchText(alias)))) {
      sportTerms.push(...aliases);
    }
  }

  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(match.date);
  const dateTerms = dateParts
    ? [match.date, `${dateParts[1]}/${dateParts[2]}/${dateParts[3]}`, `${dateParts[2]}/${dateParts[3]}`, `${Number(dateParts[2])}/${Number(dateParts[3])}`]
    : [match.date];

  return normalizeSearchText([
    ...sportTerms,
    match.match,
    match.match_en,
    match.display_date,
    ...dateTerms,
  ].join(" "));
}

export function searchStoreMatches(store: StoreData, matches: SportsMatch[], query: string): SportsMatch[] {
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return matches;

  const storeText = storeSearchText(store);
  const storeMatchesEveryToken = tokens.every(token => storeText.includes(token));
  if (storeMatchesEveryToken) return matches;

  return matches.filter(match => {
    const eventText = eventSearchText(match);
    return tokens.every(token => storeText.includes(token) || eventText.includes(token));
  });
}
