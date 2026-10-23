export type BroadcastStatus = "showing" | "not_showing" | "unconfirmed";
export type Language = "ja" | "en";
export type FilterValue = "all" | BroadcastStatus;

export interface SportsMatch {
  date: string;
  display_date: string;
  sport: string;
  match: string;
  match_en: string;
  broadcastStatus: BroadcastStatus;
}

export interface StoreData {
  id: string;
  url: string;
  name: string;
  name_en: string;
  address: string;
  region: string;
  prefecture: string;
  prefecture_en: string;
  city: string;
  matches: SportsMatch[];
}

export interface ApiResponse {
  updatedAt: string | null;
  data: StoreData[];
}

export interface FilterOption {
  value: string;
  label: string;
  date?: string;
}
