import type { BroadcastStatus, Language } from "./types";

export const REGIONS = ["すべて", "北海道", "東北", "関東", "中部", "近畿", "中国", "四国", "九州"];

export const REGION_MAPPING: Record<string, string[]> = {
  "すべて": [],
  "北海道": ["北海道"],
  "東北": ["青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"],
  "関東": ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"],
  "中部": ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県"],
  "近畿": ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"],
  "中国": ["鳥取県", "島根県", "岡山県", "広島県", "山口県"],
  "四国": ["徳島県", "香川県", "愛媛県", "高知県"],
  "九州": ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"],
};

export const CITY_MAPPING: Record<string, string[]> = {
  "東京都": ["すべて", "千代田区", "中央区", "港区", "新宿区", "文京区", "台東区", "墨田区", "江東区", "品川区", "目黒区", "大田区", "世田谷区", "渋谷区", "中野区", "杉並区", "豊島区", "北区", "荒川区", "板橋区", "練馬区", "足立区", "葛飾区", "江戸川区", "町田市", "八王子市", "武蔵野市", "立川市"],
};

export const BROADCAST_STATUS_ORDER: BroadcastStatus[] = ["showing", "not_showing", "unconfirmed"];

export const BROADCAST_STATUS_CONFIG: Record<BroadcastStatus, {
  label: Record<Language, string>;
  badgeClass: string;
}> = {
  showing: {
    label: { ja: "放映あり", en: "Showing" },
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  not_showing: {
    label: { ja: "放映なし", en: "Not showing" },
    badgeClass: "border-rose-200 bg-rose-50 text-rose-800",
  },
  unconfirmed: {
    label: { ja: "確認中", en: "Unconfirmed" },
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
  },
};

export const BROADCAST_STATUS_LABELS: Record<Language, string> = {
  ja: "放映状況で絞り込む",
  en: "Filter by Broadcast Status",
};

export const SHOW_STORE_LINK_NOTICE = false;
export const SHOW_SPORTS_EVENTS_RETURN_LINK = false;

export const STORE_LINK_NOTICE: Record<Language, string> = {
  ja: "店舗名から公式店舗情報を確認できます。",
  en: "Store names link to official store information.",
};
