"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { ChartPoint } from "@/lib/history/analytics";

export function DashboardChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return <div className="chart-empty">Complete a practice session to start your chart.</div>;
  }

  return (
    <div className="history-chart" aria-label="Average WPM and accuracy over time">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 14, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" stroke="var(--muted)" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis stroke="var(--muted)" tickLine={false} axisLine={false} fontSize={11} />
          <Tooltip
            contentStyle={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              color: "var(--text)",
              background: "var(--surface-raised)",
              fontSize: 12
            }}
          />
          <Line type="monotone" dataKey="wpm" name="WPM" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="accuracy" name="Accuracy %" stroke="var(--correct)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
