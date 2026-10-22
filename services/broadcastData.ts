import type { ApiResponse, BroadcastStatus, SportsMatch, StoreData } from "../types";

const BROADCAST_STATUSES = new Set<BroadcastStatus>(["showing", "not_showing", "unconfirmed"]);
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: UnknownRecord, key: string, path: string, allowEmpty = false): string {
  const value = record[key];
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0)) {
    throw new Error(`Invalid broadcast data: ${path}.${key} must be a string.`);
  }
  return value;
}

function localizedString(record: UnknownRecord, key: string, fallback: string): string {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function isValidDateOnly(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidTimestamp(value: string): boolean {
  const match = ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    && hour < 24
    && minute < 60
    && second < 60;
}

export function getMatchKey(match: Pick<SportsMatch, "date" | "match">): string {
  return JSON.stringify([match.date, match.match]);
}

export function decodeBroadcastData(input: unknown): ApiResponse {
  if (!isRecord(input)) {
    throw new Error("Invalid broadcast data: expected an object with updatedAt and data.");
  }

  const updatedAtValue = input.updatedAt;
  if (updatedAtValue !== null && (typeof updatedAtValue !== "string" || !isValidTimestamp(updatedAtValue))) {
    throw new Error("Invalid broadcast data: updatedAt must be null or a valid ISO timestamp.");
  }

  if (!Array.isArray(input.data)) {
    throw new Error("Invalid broadcast data: data must be an array.");
  }

  const storeIds = new Set<string>();
  const data = input.data.map((item, storeIndex): StoreData => {
    const path = `data[${storeIndex}]`;
    if (!isRecord(item)) {
      throw new Error(`Invalid broadcast data: ${path} must be an object.`);
    }

    const id = requiredString(item, "id", path);
    if (storeIds.has(id)) {
      throw new Error(`Invalid broadcast data: duplicate store id at ${path}.`);
    }
    storeIds.add(id);

    const name = requiredString(item, "name", path);
    const prefecture = requiredString(item, "prefecture", path);
    if (!Array.isArray(item.matches)) {
      throw new Error(`Invalid broadcast data: ${path}.matches must be an array.`);
    }

    const matchKeys = new Set<string>();
    const matches = item.matches.map((rawMatch, matchIndex): SportsMatch => {
      const matchPath = `${path}.matches[${matchIndex}]`;
      if (!isRecord(rawMatch)) {
        throw new Error(`Invalid broadcast data: ${matchPath} must be an object.`);
      }

      const date = requiredString(rawMatch, "date", matchPath);
      if (!isValidDateOnly(date)) {
        throw new Error(`Invalid broadcast data: ${matchPath}.date must use YYYY-MM-DD.`);
      }

      const match = requiredString(rawMatch, "match", matchPath);
      const key = getMatchKey({ date, match });
      if (matchKeys.has(key)) {
        throw new Error(`Invalid broadcast data: duplicate date and match at ${matchPath}.`);
      }
      matchKeys.add(key);

      const rawStatus = rawMatch.broadcastStatus;
      const broadcastStatus = typeof rawStatus === "string" && BROADCAST_STATUSES.has(rawStatus as BroadcastStatus)
        ? rawStatus as BroadcastStatus
        : "unconfirmed";

      return {
        date,
        display_date: requiredString(rawMatch, "display_date", matchPath),
        sport: requiredString(rawMatch, "sport", matchPath),
        match,
        match_en: localizedString(rawMatch, "match_en", match),
        broadcastStatus,
      };
    });

    return {
      id,
      url: requiredString(item, "url", path, true),
      name,
      name_en: localizedString(item, "name_en", name),
      address: requiredString(item, "address", path, true),
      region: requiredString(item, "region", path),
      prefecture,
      prefecture_en: localizedString(item, "prefecture_en", prefecture),
      city: requiredString(item, "city", path),
      matches,
    };
  });

  return { updatedAt: updatedAtValue as string | null, data };
}
