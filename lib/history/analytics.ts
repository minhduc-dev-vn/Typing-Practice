import type { PracticeHistoryRow } from "@/lib/history/types";

export type ChartPeriod = "day" | "week" | "month";

export interface HistorySummary {
  totalSeconds: number;
  averageWpm: number;
  averageAccuracy: number;
  sessionCount: number;
}

export interface ChartPoint {
  key: string;
  label: string;
  wpm: number;
  accuracy: number;
  sessions: number;
}

export function calculateHistorySummary(rows: readonly PracticeHistoryRow[]): HistorySummary {
  if (rows.length === 0) {
    return { totalSeconds: 0, averageWpm: 0, averageAccuracy: 0, sessionCount: 0 };
  }

  const totals = rows.reduce((summary, row) => ({
    totalSeconds: summary.totalSeconds + Number(row.duration_seconds),
    wpm: summary.wpm + Number(row.wpm),
    accuracy: summary.accuracy + Number(row.accuracy)
  }), { totalSeconds: 0, wpm: 0, accuracy: 0 });

  return {
    totalSeconds: totals.totalSeconds,
    averageWpm: totals.wpm / rows.length,
    averageAccuracy: totals.accuracy / rows.length,
    sessionCount: rows.length
  };
}

export function aggregateHistory(
  rows: readonly PracticeHistoryRow[],
  period: ChartPeriod
): ChartPoint[] {
  const buckets = new Map<string, { wpm: number; accuracy: number; sessions: number; date: Date }>();

  for (const row of rows) {
    const date = new Date(row.created_at);
    const bucketDate = startOfPeriod(date, period);
    const key = bucketDate.toISOString().slice(0, 10);
    const existing = buckets.get(key) ?? { wpm: 0, accuracy: 0, sessions: 0, date: bucketDate };
    existing.wpm += Number(row.wpm);
    existing.accuracy += Number(row.accuracy);
    existing.sessions += 1;
    buckets.set(key, existing);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(period === "day" ? -14 : period === "week" ? -12 : -12)
    .map(([key, bucket]) => ({
      key,
      label: formatPeriodLabel(bucket.date, period),
      wpm: roundOne(bucket.wpm / bucket.sessions),
      accuracy: roundOne(bucket.accuracy / bucket.sessions),
      sessions: bucket.sessions
    }));
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function startOfPeriod(date: Date, period: ChartPeriod): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (period === "week") {
    const weekday = result.getUTCDay() || 7;
    result.setUTCDate(result.getUTCDate() - weekday + 1);
  } else if (period === "month") {
    result.setUTCDate(1);
  }
  return result;
}

function formatPeriodLabel(date: Date, period: ChartPeriod): string {
  if (period === "month") {
    return new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
  }
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}
