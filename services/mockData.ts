import type { StoreData } from '../types';

/** Explicitly fictional demo data for local UI work. Production never imports this fixture. */
export const getMockStoreData = (): StoreData[] => [
  {
    id: 'demo-store-0001',
    url: '',
    name: '架空サンプル店舗',
    name_en: 'Fictional Sample Store',
    address: '東京都 千代田区（架空）',
    region: '関東',
    prefecture: '東京都',
    prefecture_en: 'Tokyo',
    city: '千代田区',
    matches: [
      {
        date: '2099-01-01',
        display_date: '2099/01/01',
        sport: 'サンプル競技',
        match: '架空チームA vs 架空チームB',
        match_en: 'Fictional Team A vs Fictional Team B',
        broadcastStatus: 'unconfirmed',
      },
    ],
  },
];
