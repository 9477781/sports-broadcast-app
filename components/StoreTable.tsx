import React, { useMemo, useRef } from "react";
import { BROADCAST_STATUS_CONFIG } from "../constants";
import { getMatchKey } from "../services/broadcastData";
import { getMatchDateLabel, getMatchPresentation, getSportPresentation } from "../services/broadcastPresentation";
import { isJapanesePublicHoliday } from "../services/japaneseHolidays";
import type { Language, SportsMatch, StoreData } from "../types";

interface StoreTableProps {
  data: StoreData[];
  language: Language;
}

function getMatchSortKey(match: SportsMatch): string {
  const timeMatch = /[(（]([0-9:：]+)[)）]\s*$/.exec(match.match);
  const time = timeMatch ? timeMatch[1].replace("：", ":").padStart(5, "0") : "99:99";
  return `${match.date} ${time}`;
}

const StoreTable: React.FC<StoreTableProps> = ({ data, language }) => {
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const headerMatches = useMemo(() => {
    const matchesByKey = new Map<string, SportsMatch>();
    data.forEach(store => {
      store.matches.forEach(match => matchesByKey.set(getMatchKey(match), match));
    });
    return Array.from(matchesByKey.values()).sort((left, right) => getMatchSortKey(left).localeCompare(getMatchSortKey(right)));
  }, [data]);

  if (data.length === 0) return null;

  const handleBodyScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (headerRef.current) headerRef.current.scrollLeft = event.currentTarget.scrollLeft;
  };

  const tableWidth = headerMatches.length > 0
    ? `calc(140px + 240px + ${headerMatches.length} * 300px)`
    : "100%";

  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div ref={headerRef} className="overflow-hidden bg-orange-500">
        <table className="table-fixed border-separate border-spacing-0" style={{ width: tableWidth }}>
          <thead>
            <tr className="h-[210px]">
              <th scope="col" className="sticky left-0 z-40 w-[140px] min-w-[140px] max-w-[140px] border-b border-r border-white/20 bg-orange-500 p-0 text-[15px] font-bold text-white">
                <div className="flex h-full items-center justify-center p-4">{language === "ja" ? "エリア" : "Area"}</div>
              </th>
              <th scope="col" className="sticky left-[140px] z-40 w-[240px] min-w-[240px] max-w-[240px] border-b border-r border-white/20 bg-orange-500 p-0 text-lg font-bold text-white">
                <div className="flex h-full items-center justify-center p-4">{language === "ja" ? "店名" : "Store"}</div>
              </th>
              {headerMatches.map(match => {
                const { title, time } = getMatchPresentation(match, language);
                const sport = getSportPresentation(match.sport, language);
                const dayOfWeek = new Date(`${match.date}T00:00:00Z`).getUTCDay();
                const isHoliday = dayOfWeek === 0 || isJapanesePublicHoliday(match.date);
                const dateHeaderClass = isHoliday ? "bg-red-500" : dayOfWeek === 6 ? "bg-blue-600" : "bg-orange-500";

                return (
                  <th key={getMatchKey(match)} scope="col" className="w-[300px] min-w-[300px] max-w-[300px] border-b border-r border-white/10 bg-slate-800 p-0 text-white">
                    <div className="flex h-full flex-col overflow-hidden">
                      <div className={`flex h-[54px] min-h-[54px] items-center justify-center border-b border-white/10 p-3 text-lg font-bold ${dateHeaderClass}`}>
                        {getMatchDateLabel(match, language)}
                      </div>
                      <div className="flex h-[42px] items-center justify-center border-b border-white/10 bg-slate-800 p-2">
                        <span className={`rounded-full border px-3 py-1 text-sm font-bold ${sport.badgeClass}`}>
                          {sport.label}
                        </span>
                      </div>
                      <div className="flex min-h-[100px] flex-1 flex-col items-center justify-center p-4 text-center leading-tight text-slate-100">
                        <span className="text-base font-black">{title}</span>
                        {time && <span className="mt-1 text-base font-black text-orange-300">{time}</span>}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
        </table>
      </div>

      <div ref={bodyRef} onScroll={handleBodyScroll} className="custom-scrollbar max-h-[700px] overflow-auto bg-white">
        <table className="table-fixed border-separate border-spacing-0 bg-white" style={{ width: tableWidth }}>
          <tbody>
            {data.map((store, rowIndex) => {
              const matchesByKey = new Map<string, SportsMatch>(store.matches.map(match => [getMatchKey(match), match]));
              const rowColor = rowIndex % 2 === 0 ? "bg-white" : "bg-[#fcfdfe]";

              return (
                <tr key={store.id} className={`group transition-colors ${rowColor} hover:bg-orange-50/30`}>
                  <th scope="row" className={`sticky left-0 z-20 w-[140px] min-w-[140px] max-w-[140px] overflow-hidden border-b border-r border-slate-200 p-5 text-left text-[15px] font-bold text-slate-500 ${rowColor}`}>
                    {language === "ja" ? `${store.prefecture} ${store.city}` : store.prefecture_en}
                  </th>
                  <td className={`sticky left-[140px] z-20 w-[240px] min-w-[240px] max-w-[240px] overflow-hidden border-b border-r border-slate-200 p-5 ${rowColor}`}>
                    {/* Keep store.url in the data model for future link display; names are plain text for now. */}
                    <span className="text-lg font-black leading-tight text-slate-900">{language === "ja" ? store.name : store.name_en}</span>
                  </td>
                  {headerMatches.map(matchHeader => {
                    const match = matchesByKey.get(getMatchKey(matchHeader));
                    if (!match || match.broadcastStatus !== "showing") {
                      return (
                        <td key={getMatchKey(matchHeader)} aria-label={language === "ja" ? "放映予定の記載なし" : "No broadcast listed"} className={`w-[300px] min-w-[300px] max-w-[300px] border-b border-r border-slate-200 p-3 text-center align-middle text-sm text-slate-400 ${rowColor}`}>
                          —
                        </td>
                      );
                    }
                    const status = BROADCAST_STATUS_CONFIG.showing;
                    return (
                      <td key={getMatchKey(matchHeader)} className={`w-[300px] min-w-[300px] max-w-[300px] border-b border-r border-slate-200 p-3 text-center align-middle ${rowColor}`}>
                        <span className={`inline-flex items-center rounded-full border px-4 py-2 text-base font-bold ${status.badgeClass}`}>
                          {status.label[language]}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StoreTable;
