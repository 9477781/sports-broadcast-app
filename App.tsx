import React, { useEffect, useState } from "react";
import Header from "./components/Header";
import FilterControls from "./components/FilterControls";
import StoreTable from "./components/StoreTable";
import StoreCard from "./components/StoreCard";
import { SHOW_STORE_LINK_NOTICE, STORE_LINK_NOTICE } from "./constants";
import { decodeBroadcastData, getMatchKey } from "./services/broadcastData";
import { getMatchDateLabel, getMatchPresentation, getSportFilterValue, getSportPresentation } from "./services/broadcastPresentation";
import { getBroadcastDateWindow, isBroadcastVisible } from "./services/broadcastVisibility";
import { geoDisplayLabel, searchStoreMatches } from "./services/broadcastSearch";
import type { FilterOption, Language, SportsMatch, StoreData } from "./types";

const BROADCAST_DATA_URL = "/data/broadcast.json";
const BROADCAST_REFRESH_INTERVAL_MS = 60_000;
const ALL_FILTER_VALUE = "__all__";
const REGION_ORDER = ["関東", "関西", "中部", "東北", "九州", "北海道"];
const KANTO_PREFECTURE_ORDER = ["東京都", "埼玉県", "千葉県", "神奈川県"];

type StoreFilterDimension = "region" | "prefecture" | "store";
type MatchFilterDimension = "date" | "sport" | "match";
type LoadState = "loading" | "ready" | "error";

function getMatchSortKey(match: SportsMatch): string {
  const timeMatch = /[(（]([0-9:：]+)[)）]\s*$/.exec(match.match);
  const time = timeMatch ? timeMatch[1].replace("：", ":").padStart(5, "0") : "99:99";
  return `${match.date} ${time}`;
}

function sortedUnique(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function retainSelectedOptions(options: FilterOption[], selected: string[], allOptions: FilterOption[]): FilterOption[] {
  const present = new Set(options.map(option => option.value));
  return [...options, ...allOptions.filter(option => selected.includes(option.value) && !present.has(option.value))];
}

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>("ja");
  const [data, setData] = useState<StoreData[]>([]);
  const [dateWindow, setDateWindow] = useState(() => getBroadcastDateWindow());
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 1024);
  const [retryCount, setRetryCount] = useState(0);

  const [draftSearchQuery, setDraftSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState(ALL_FILTER_VALUE);
  const [selectedPrefecture, setSelectedPrefecture] = useState(ALL_FILTER_VALUE);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedMatchKeys, setSelectedMatchKeys] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let isFetching = false;
    let hasLoaded = false;
    setLoadState("loading");
    const loadBroadcastData = async () => {
      if (isFetching) return;
      isFetching = true;
      try {
        const response = await fetch(BROADCAST_DATA_URL, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Broadcast feed request failed.");
        const payload: unknown = await response.json();
        const result = decodeBroadcastData(payload);
        if (controller.signal.aborted) return;
        setData(result.data);
        setUpdatedAt(result.updatedAt);
        setLoadState("ready");
        hasLoaded = true;
      } catch {
        if (controller.signal.aborted) return;
        // Keep the last valid schedule visible during a temporary refresh failure.
        if (!hasLoaded) {
          setData([]);
          setUpdatedAt(null);
          setLoadState("error");
        }
      } finally {
        isFetching = false;
      }
    };
    const refreshVisibleData = () => {
      if (!document.hidden) void loadBroadcastData();
    };

    void loadBroadcastData();
    const interval = window.setInterval(refreshVisibleData, BROADCAST_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshVisibleData);
    document.addEventListener("visibilitychange", refreshVisibleData);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisibleData);
      document.removeEventListener("visibilitychange", refreshVisibleData);
    };
  }, [retryCount]);

  useEffect(() => {
    const refreshDateWindow = () => {
      const nextWindow = getBroadcastDateWindow();
      setDateWindow(current => current.startDate === nextWindow.startDate ? current : nextWindow);
    };
    const handleVisibility = () => {
      if (!document.hidden) refreshDateWindow();
    };

    const interval = window.setInterval(refreshDateWindow, 60_000);
    window.addEventListener("focus", refreshDateWindow);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshDateWindow);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const matchesStoreFilters = (store: StoreData, excluded?: StoreFilterDimension): boolean => {
    if (excluded !== "region" && selectedRegion !== ALL_FILTER_VALUE && store.region !== selectedRegion) return false;
    if (excluded !== "prefecture" && selectedPrefecture !== ALL_FILTER_VALUE && store.prefecture !== selectedPrefecture) return false;
    if (excluded !== "store" && selectedStoreIds.length > 0 && !selectedStoreIds.includes(store.id)) return false;
    return true;
  };

  const matchesEventFilters = (match: SportsMatch, excluded?: MatchFilterDimension): boolean => {
    if (excluded !== "date" && selectedDates.length > 0 && !selectedDates.includes(match.date)) return false;
    if (excluded !== "sport" && selectedSports.length > 0 && !selectedSports.includes(getSportFilterValue(match.sport))) return false;
    if (excluded !== "match" && selectedMatchKeys.length > 0 && !selectedMatchKeys.includes(getMatchKey(match))) return false;
    return true;
  };

  const visibleData = data
    .map(store => ({ ...store, matches: store.matches.filter(match => isBroadcastVisible(match, dateWindow)) }))
    .filter(store => store.matches.length > 0);

  const searchedData = visibleData
    .map(store => ({ ...store, matches: searchStoreMatches(store, store.matches, appliedSearchQuery) }))
    .filter(store => store.matches.length > 0);

  const visibleMatches = visibleData.flatMap(store => store.matches);
  const getOptionMatches = (excluded: MatchFilterDimension) => searchedData
    .filter(store => matchesStoreFilters(store))
    .flatMap(store => store.matches.filter(match => matchesEventFilters(match, excluded)));

  const makeDateOptions = (input: SportsMatch[]): FilterOption[] => {
    const labels = new Map(input.map(match => [match.date, getMatchDateLabel(match, language)]));
    return Array.from(labels, ([value, label]) => ({ value, label })).sort((left, right) => left.value.localeCompare(right.value));
  };

  const makeSportOptions = (input: SportsMatch[]): FilterOption[] => {
    const optionsBySport = new Map<string, SportsMatch>();
    input.forEach(match => optionsBySport.set(getSportFilterValue(match.sport), match));
    return Array.from(optionsBySport, ([value, match]) => ({
      value,
      label: getSportPresentation(match.sport, language).label,
    })).sort((left, right) => left.label.localeCompare(right.label));
  };

  const makeMatchOptions = (input: SportsMatch[]): FilterOption[] => {
    const uniqueMatches = new Map(input.map(match => [getMatchKey(match), match]));
    return Array.from(uniqueMatches.values())
      .sort((left, right) => getMatchSortKey(left).localeCompare(getMatchSortKey(right)))
      .map(match => {
        const presentation = getMatchPresentation(match, language);
        return {
          value: getMatchKey(match),
          label: getMatchDateLabel(match, language) + " · " + presentation.title + (presentation.time ? " (" + presentation.time + ")" : ""),
        };
      });
  };

  // Region and prefecture tabs are based on the fixed 10-day/showing feed, so temporary filters cannot remove them.
  const availableRegions = sortedUnique(visibleData.map(store => store.region));
  const regions = [
    { value: ALL_FILTER_VALUE, label: "すべて" },
    ...availableRegions.sort((left, right) => {
      const leftIndex = REGION_ORDER.indexOf(left);
      const rightIndex = REGION_ORDER.indexOf(right);
      if (leftIndex >= 0 || rightIndex >= 0) return (leftIndex < 0 ? 100 : leftIndex) - (rightIndex < 0 ? 100 : rightIndex);
      return left.localeCompare(right);
    }).map(value => ({ value, label: geoDisplayLabel(value, "ja") })),
  ];

  const prefectureBase = visibleData.filter(store => selectedRegion === ALL_FILTER_VALUE || store.region === selectedRegion);
  const availablePrefectures = sortedUnique(prefectureBase.map(store => store.prefecture));
  availablePrefectures.sort((left, right) => {
    if (selectedRegion === "関東") {
      const leftIndex = KANTO_PREFECTURE_ORDER.indexOf(left);
      const rightIndex = KANTO_PREFECTURE_ORDER.indexOf(right);
      if (leftIndex >= 0 || rightIndex >= 0) return (leftIndex < 0 ? 100 : leftIndex) - (rightIndex < 0 ? 100 : rightIndex);
    }
    return left.localeCompare(right);
  });
  const prefectures = [
    { value: ALL_FILTER_VALUE, label: "すべて" },
    ...availablePrefectures.map(value => ({ value, label: geoDisplayLabel(value, "ja") })),
  ];

  const storeOptionData = searchedData.filter(store =>
    matchesStoreFilters(store, "store") && store.matches.some(match => matchesEventFilters(match)),
  );
  const availableStores = storeOptionData
    .map(store => ({ value: store.id, label: language === "ja" ? store.name : store.name_en }))
    .sort((left, right) => left.label.localeCompare(right.label));

  const stores = retainSelectedOptions(availableStores, selectedStoreIds, visibleData.map(store => ({ value: store.id, label: language === "ja" ? store.name : store.name_en })));
  const dates = retainSelectedOptions(makeDateOptions(getOptionMatches("date")), selectedDates, makeDateOptions(visibleMatches));
  const sports = retainSelectedOptions(makeSportOptions(getOptionMatches("sport")), selectedSports, makeSportOptions(visibleMatches));
  const matches = retainSelectedOptions(makeMatchOptions(getOptionMatches("match")), selectedMatchKeys, makeMatchOptions(visibleMatches));

  const filteredData = searchedData
    .map(store => ({
      ...store,
      matches: store.matches
        .filter(match => matchesEventFilters(match))
        .sort((left, right) => getMatchSortKey(left).localeCompare(getMatchSortKey(right))),
    }))
    .filter(store => store.matches.length > 0 && matchesStoreFilters(store));

  const handleReset = () => {
    setDraftSearchQuery("");
    setAppliedSearchQuery("");
    setSelectedRegion(ALL_FILTER_VALUE);
    setSelectedPrefecture(ALL_FILTER_VALUE);
    setSelectedStoreIds([]);
    setSelectedDates([]);
    setSelectedSports([]);
    setSelectedMatchKeys([]);
  };

  const handleRegionChange = (value: string) => {
    setSelectedRegion(value);
    setSelectedPrefecture(ALL_FILTER_VALUE);
    setSelectedStoreIds([]);
  };

  const handlePrefectureChange = (value: string) => {
    setSelectedPrefecture(value);
    setSelectedStoreIds([]);
  };

  const scheduleNotice = language === "ja"
    ? "放映予定は変更になる場合があります。最新情報は各店舗にお問い合わせください。"
    : "Broadcast schedules may change. Contact the store to confirm the latest information.";

  return (
    <div className="min-h-screen bg-slate-50">
      <Header language={language} onLanguageChange={setLanguage} lastUpdated={updatedAt} />

      <main className="mx-auto max-w-[1600px] px-4 py-8">
        {loadState === "ready" && data.length > 0 && (
          <>
            <FilterControls
              language={language}
              draftSearchQuery={draftSearchQuery}
              onSearchChange={setDraftSearchQuery}
              onSearchSubmit={() => setAppliedSearchQuery(draftSearchQuery)}
              selectedRegion={selectedRegion}
              onRegionChange={handleRegionChange}
              regions={regions}
              selectedPrefecture={selectedPrefecture}
              onPrefectureChange={handlePrefectureChange}
              prefectures={prefectures}
              selectedStoreIds={selectedStoreIds}
              onStoreIdsChange={setSelectedStoreIds}
              stores={stores}
              selectedDates={selectedDates}
              onDatesChange={setSelectedDates}
              dates={dates}
              selectedSports={selectedSports}
              onSportsChange={setSelectedSports}
              sports={sports}
              selectedMatchKeys={selectedMatchKeys}
              onMatchKeysChange={setSelectedMatchKeys}
              matches={matches}
              dateWindow={dateWindow}
              onReset={handleReset}
            />

            <div className="mb-4 px-1 text-[11px] font-medium text-slate-500 md:text-sm">
              <p>{scheduleNotice}</p>
              {SHOW_STORE_LINK_NOTICE && <p>{STORE_LINK_NOTICE[language]}</p>}
            </div>
          </>
        )}

        {loadState === "loading" && (
          <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" aria-hidden="true" />
            <p className="text-lg font-medium text-slate-500">{language === "ja" ? "読み込み中..." : "Loading..."}</p>
          </div>
        )}

        {loadState === "error" && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-white px-6 py-12 text-center shadow-sm">
            <p className="font-bold text-slate-700">{language === "ja" ? "放映情報を読み込めませんでした。" : "Broadcast information could not be loaded."}</p>
            <button
              type="button"
              onClick={() => setRetryCount(count => count + 1)}
              className="mt-5 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-700"
            >
              {language === "ja" ? "再試行" : "Retry"}
            </button>
          </div>
        )}

        {loadState === "ready" && data.length === 0 && (
          <div role="status" className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center text-lg font-bold text-slate-600 shadow-sm">
            {language === "ja" ? "現在、放映予定がありません。" : "No broadcasts are currently scheduled."}
          </div>
        )}

        {loadState === "ready" && data.length > 0 && visibleData.length === 0 && (
          <div role="status" className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center font-medium text-slate-500 shadow-sm">
            {language === "ja" ? "表示期間内の放映予定がありません。" : "No broadcasts are scheduled in the display period."}
          </div>
        )}

        {loadState === "ready" && data.length > 0 && visibleData.length > 0 && filteredData.length === 0 && (
          <div role="status" className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center font-medium text-slate-500 shadow-sm">
            {language === "ja" ? "条件に一致する試合が見つかりませんでした。" : "No matches found for these filters."}
          </div>
        )}

        {loadState === "ready" && data.length > 0 && filteredData.length > 0 && (
          isMobile ? (
            <div className="space-y-3">
              {filteredData.map(store => <StoreCard key={store.id} data={store} language={language} />)}
            </div>
          ) : (
            <StoreTable data={filteredData} language={language} />
          )
        )}
      </main>
    </div>
  );
};

export default App;

