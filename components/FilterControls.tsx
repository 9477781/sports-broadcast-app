import React, { useEffect, useId, useRef, useState } from "react";
import { formatBroadcastDate, type BroadcastDateWindow } from "../services/broadcastVisibility";
import { isJapanesePublicHoliday } from "../services/japaneseHolidays";
import { geoDisplayLabel } from "../services/broadcastSearch";
import type { FilterOption, Language } from "../types";

interface MultiSelectProps {
  language: Language;
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  optionLabelClassName?: (option: FilterOption) => string;
  renderOptionLabel?: (option: FilterOption) => React.ReactNode;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ language, label, options, selectedValues, onChange, optionLabelClassName, renderOptionLabel }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    onChange(selectedValues.includes(value)
      ? selectedValues.filter(selected => selected !== value)
      : [...selectedValues, value]);
  };
  const currentLabel = selectedValues.length > 0 ? `${label} (${selectedValues.length})` : label;

  return (
    <div className="relative min-w-0 w-full" ref={containerRef}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setIsOpen(open => !open)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-bold shadow-sm transition-colors hover:border-slate-300 sm:text-sm md:min-h-14 md:px-4 md:text-base"
      >
        <span className={`truncate ${selectedValues.length > 0 ? "text-blue-700" : "text-slate-600"}`}>{currentLabel}</span>
        <svg className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div id={listId} className="absolute z-[100] mt-1 max-h-60 w-full space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
          {options.map(option => (
            <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 transition-colors hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selectedValues.includes(option.value)}
                onChange={() => toggleOption(option.value)}
                className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 md:h-5 md:w-5"
              />
              <span className={`whitespace-normal text-sm font-medium leading-tight md:text-base ${optionLabelClassName?.(option) ?? "text-slate-700"}`}>
                {renderOptionLabel ? renderOptionLabel(option) : option.label}
              </span>
            </label>
          ))}
          {options.length === 0 && (
            <div role="status" className="p-2 text-center text-xs italic text-slate-400">
              {language === "ja" ? "選択肢がありません" : "No options"}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface FilterControlsProps {
  language: Language;
  draftSearchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  selectedRegion: string;
  onRegionChange: (value: string) => void;
  regions: FilterOption[];
  selectedPrefecture: string;
  onPrefectureChange: (value: string) => void;
  prefectures: FilterOption[];
  selectedCity: string;
  onCityChange: (value: string) => void;
  municipalities: FilterOption[];
  selectedStoreIds: string[];
  onStoreIdsChange: (values: string[]) => void;
  stores: FilterOption[];
  selectedDates: string[];
  onDatesChange: (values: string[]) => void;
  dates: FilterOption[];
  selectedSports: string[];
  onSportsChange: (values: string[]) => void;
  sports: FilterOption[];
  selectedMatchKeys: string[];
  onMatchKeysChange: (values: string[]) => void;
  matches: FilterOption[];
  dateWindow: BroadcastDateWindow;
  onReset: () => void;
}

const FilterControls: React.FC<FilterControlsProps> = ({
  language,
  draftSearchQuery,
  onSearchChange,
  onSearchSubmit,
  selectedRegion,
  onRegionChange,
  regions,
  selectedPrefecture,
  onPrefectureChange,
  prefectures,
  selectedCity,
  onCityChange,
  municipalities,
  selectedStoreIds,
  onStoreIdsChange,
  stores,
  selectedDates,
  onDatesChange,
  dates,
  selectedSports,
  onSportsChange,
  sports,
  selectedMatchKeys,
  onMatchKeysChange,
  matches,
  dateWindow,
  onReset,
}) => {
  const dateRange = `${formatBroadcastDate(dateWindow.startDate)}〜${formatBroadcastDate(dateWindow.endDate)}`;
  const regionButtonClass = (selected: boolean) => selected
    ? "bg-slate-800 text-white shadow-sm"
    : "bg-slate-200 text-slate-700 hover:bg-slate-300";
  const prefectureButtonClass = (selected: boolean) => selected
    ? "bg-blue-600 text-white shadow-sm"
    : "bg-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-800";

  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5" aria-label={language === "ja" ? "検索と絞り込み" : "Search and filters"}>
      <div className="space-y-2.5 md:space-y-4">
        <form
          className="flex min-w-0"
          onSubmit={event => {
            event.preventDefault();
            onSearchSubmit();
          }}
        >
          <label className="sr-only" htmlFor="broadcast-keyword-search">
            {language === "ja" ? "店舗名・住所・試合名で検索" : "Search stores, addresses, or matches"}
          </label>
          <input
            id="broadcast-keyword-search"
            type="search"
            placeholder={language === "ja" ? "店舗名・住所・試合名などで検索..." : "Search stores, addresses, matches..."}
            value={draftSearchQuery}
            onChange={event => onSearchChange(event.target.value)}
            className="h-11 min-w-0 flex-1 rounded-l-lg border border-r-0 border-slate-200 bg-white px-3 text-sm shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 md:h-14 md:px-4 md:text-base"
          />
          <button type="submit" className="h-11 shrink-0 rounded-r-lg bg-slate-800 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-700 md:h-14 md:px-7 md:text-base">
            {language === "ja" ? "検索" : "Search"}
          </button>
        </form>

        <div className="grid grid-cols-2 gap-2.5 md:gap-3" aria-label={language === "ja" ? "店舗・日付・競技・カードの選択" : "Store, date, sport and match selection"}>
        <MultiSelect
          language={language}
          label={language === "ja" ? "店名で絞り込み" : "Filter by store"}
          options={stores}
          selectedValues={selectedStoreIds}
          onChange={onStoreIdsChange}
        />
        <MultiSelect
          language={language}
          label={language === "ja" ? "日付で絞り込み" : "Filter by date"}
          options={dates}
          selectedValues={selectedDates}
          onChange={onDatesChange}
          optionLabelClassName={option => {
            const weekday = new Date(`${option.value}T00:00:00Z`).getUTCDay();
            if (weekday === 0 || isJapanesePublicHoliday(option.value)) return "text-rose-700";
            if (weekday === 6) return "text-blue-700";
            return "text-slate-700";
          }}
        />
        <MultiSelect
          language={language}
          label={language === "ja" ? "競技で絞り込み" : "Filter by sport"}
          options={sports}
          selectedValues={selectedSports}
          onChange={onSportsChange}
        />
        <MultiSelect
          language={language}
          label={language === "ja" ? "カードで絞り込み" : "Filter by match"}
          options={matches}
          selectedValues={selectedMatchKeys}
          onChange={onMatchKeysChange}
          renderOptionLabel={option => {
            if (!option.date) return option.label;
            const separatorIndex = option.label.indexOf(" · ");
            if (separatorIndex < 0) return option.label;
            const weekday = new Date(`${option.date}T00:00:00Z`).getUTCDay();
            const dateClass = weekday === 0 || isJapanesePublicHoliday(option.date)
              ? "text-rose-700"
              : weekday === 6 ? "text-blue-700" : "text-slate-700";
            return <><span className={`font-bold ${dateClass}`}>{option.label.slice(0, separatorIndex)}</span>{option.label.slice(separatorIndex)}</>;
          }}
        />
        </div>
      </div>

      <div className="mt-3 space-y-2.5 md:mt-5 md:space-y-4">
        <div className="flex items-start gap-2">
          <span className="w-14 shrink-0 pt-1.5 text-xs font-bold text-slate-500 md:w-20 md:pt-2 md:text-sm">{language === "ja" ? "地域" : "Region"}</span>
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5 sm:flex-wrap sm:overflow-visible md:gap-2" role="group" aria-label={language === "ja" ? "地域を選択" : "Choose a region"}>
            {regions.map(option => {
              const active = selectedRegion === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onRegionChange(option.value)}
                  className={`min-h-10 shrink-0 rounded-md px-4 py-2 text-sm font-bold transition-colors md:min-h-12 md:px-6 md:py-3 md:text-base ${regionButtonClass(active)}`}
                >
                  {option.value === "__all__" ? (language === "ja" ? "すべて" : "All") : geoDisplayLabel(option.value, language)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <span className="w-14 shrink-0 pt-1.5 text-xs font-bold text-slate-500 md:w-20 md:pt-2 md:text-sm">{language === "ja" ? "都道府県" : "Prefecture"}</span>
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5 sm:flex-wrap sm:overflow-visible md:gap-2" role="group" aria-label={language === "ja" ? "都道府県を選択" : "Choose a prefecture"}>
            {prefectures.map(option => {
              const active = selectedPrefecture === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPrefectureChange(option.value)}
                  className={`min-h-10 shrink-0 rounded-md px-4 py-2 text-sm font-bold transition-colors md:min-h-12 md:px-6 md:py-3 md:text-base ${prefectureButtonClass(active)}`}
                >
                  {option.value === "__all__" ? (language === "ja" ? "すべて" : "All") : geoDisplayLabel(option.value, language)}
                </button>
              );
            })}
          </div>
        </div>

        {selectedPrefecture !== "__all__" && (
          <div className="border-t border-slate-200 pt-3 md:pt-4">
            <p className="mb-2.5 text-base font-bold text-slate-800 md:mb-3 md:text-lg">
              {geoDisplayLabel(selectedPrefecture, language)} —
            </p>
            <div className="flex min-w-0 flex-wrap gap-1.5 md:gap-2" role="group" aria-label={language === "ja" ? `${selectedPrefecture}の市区町村を選択` : "Choose a city or district"}>
              {municipalities.map(option => {
                const active = selectedCity === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onCityChange(option.value)}
                    className={`min-h-10 shrink-0 rounded-md px-4 py-2 text-sm font-bold transition-colors md:min-h-12 md:px-6 md:py-3 md:text-base ${active ? "bg-slate-800 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-800"}`}
                  >
                    {option.value === "__all__" ? (language === "ja" ? "すべて" : "All") : option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-xs font-bold text-slate-700">{language === "ja" ? "放映ありのみ表示" : "Showing broadcasts only"}</p>
          <p className="text-xs font-medium text-slate-500">{language === "ja" ? `表示期間（日本時間）：${dateRange}` : `Display period (JST): ${dateRange}`}</p>
        </div>
        <button type="button" onClick={onReset} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-bold text-orange-800 shadow-sm transition-colors hover:border-orange-500 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M5.6 15a7 7 0 1 0 .4-6" />
          </svg>
          {language === "ja" ? "条件をリセット" : "Reset filters"}
        </button>
      </div>
    </section>
  );
};

export default FilterControls;
