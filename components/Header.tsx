import React from "react";
import { SHOW_SPORTS_EVENTS_RETURN_LINK } from "../constants";
import type { Language } from "../types";

interface HeaderProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  lastUpdated: string | null;
}

const Header: React.FC<HeaderProps> = ({ language, onLanguageChange, lastUpdated }) => (
  <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900 text-white">
    <div className={`mx-auto max-w-[1600px] px-4 py-3 lg:h-16 ${SHOW_SPORTS_EVENTS_RETURN_LINK ? "flex flex-col justify-between gap-3 lg:flex-row lg:items-center" : "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2"}`}>
      <div className="flex min-w-0 flex-col items-start gap-1 lg:flex-row lg:items-center lg:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="shrink-0 rounded-lg bg-orange-500 p-1.5">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18m0-18 4 4m-4-4L8 7m4 14 4-4m-4 4-4-4" />
            </svg>
          </div>
          <h1 className="min-w-0 text-base font-bold leading-tight tracking-tight sm:text-lg lg:text-2xl">
            {language === "ja" ? "スポーツ放映情報" : "Sports Broadcast Information"}
          </h1>
        </div>
        {lastUpdated && (
          <p className="whitespace-nowrap text-left text-[9px] font-medium text-slate-400 lg:text-right lg:text-xs">
            {language === "ja" ? "更新日時" : "Updated"}: {new Date(lastUpdated).toLocaleString(language === "ja" ? "ja-JP" : "en-US", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>

      <div className={`flex items-center gap-2 overflow-hidden lg:justify-end ${SHOW_SPORTS_EVENTS_RETURN_LINK ? "w-full justify-between lg:w-auto" : "w-auto justify-end"}`}>
        {SHOW_SPORTS_EVENTS_RETURN_LINK && (
          <a
            href="https://www.pub-hub.com/index.php/event/sports"
            className="flex min-w-0 flex-grow items-center gap-1 truncate rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-[9px] font-bold text-white shadow-sm transition-all hover:bg-slate-700 lg:flex-grow-0 lg:text-sm"
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0 7-7m-7 7h18" />
            </svg>
            <span className="truncate">{language === "ja" ? "公式スポーツイベントTOPに戻る" : "Back to Sports Events TOP"}</span>
          </a>
        )}

        <div className="flex shrink-0 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          <button
            type="button"
            onClick={() => onLanguageChange("ja")}
            aria-pressed={language === "ja"}
            className={`rounded-md px-3 py-1 text-[11px] font-bold transition-all lg:text-sm ${language === "ja" ? "bg-slate-900 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
          >
            日本語
          </button>
          <button
            type="button"
            onClick={() => onLanguageChange("en")}
            aria-pressed={language === "en"}
            className={`rounded-md px-3 py-1 text-[11px] font-bold transition-all lg:text-sm ${language === "en" ? "bg-slate-900 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
          >
            EN
          </button>
        </div>
      </div>
    </div>
  </header>
);

export default Header;
