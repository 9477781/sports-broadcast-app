import React from "react";
import { getMatchKey } from "../services/broadcastData";
import { getMatchDateLabel, getMatchPresentation, getSportPresentation } from "../services/broadcastPresentation";
import type { Language, StoreData } from "../types";

interface StoreCardProps {
  data: StoreData;
  language: Language;
}

const StoreCard: React.FC<StoreCardProps> = ({ data, language }) => {
  const storeName = language === "ja" ? data.name : data.name_en;

  return (
    <article className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-2 p-4">
        <div>
          <span className="rounded-md bg-slate-400 px-3 py-1 text-[11px] font-bold text-white">
            {language === "ja" ? `${data.prefecture} ${data.city}` : data.prefecture_en}
          </span>
        </div>
        <h2 className="text-lg font-black tracking-tight text-slate-800">
          {/* Keep data.url available for future links; store names are plain text for now. */}
          {storeName}
        </h2>
      </header>

      <div className="border-t border-slate-100">
        {data.matches.map(match => {
          const { title, time } = getMatchPresentation(match, language);
          const sport = getSportPresentation(match.sport, language);
          const dayOfWeek = new Date(`${match.date}T00:00:00Z`).getUTCDay();
          const isSaturday = dayOfWeek === 6;
          const isSunday = dayOfWeek === 0;
          const dateColor = isSaturday ? "text-blue-600" : isSunday ? "text-red-600" : "text-slate-600";

          return (
            <section key={getMatchKey(match)} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
              <div className="flex items-start gap-2">
                <div className={`w-20 shrink-0 pt-1 text-sm font-bold ${dateColor}`}>{getMatchDateLabel(match, language)}</div>
                <div className="min-w-0 flex-grow">
                  <span className={`mb-1 inline-block rounded border px-2 py-0.5 text-[10px] font-bold ${sport.badgeClass}`}>
                    {sport.label}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-base font-bold leading-tight text-slate-700">
                      {title}
                    </span>
                    {time && <span className="my-1 text-base font-black text-orange-600">{time}</span>}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
};

export default StoreCard;
