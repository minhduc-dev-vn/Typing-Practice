"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AuthControls } from "@/components/AuthControls";
import { DashboardChart } from "@/components/DashboardChart";
import {
  aggregateHistory,
  calculateHistorySummary,
  formatDuration,
  type ChartPeriod
} from "@/lib/history/analytics";
import { listPracticeHistory } from "@/lib/history/client";
import type { PracticeHistoryRow } from "@/lib/history/types";
import { useAuthStore } from "@/store/authStore";

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  if (status === "loading") {
    return <DashboardLoading />;
  }

  if (!user) {
    return (
      <main className="dashboard-shell">
        <DashboardHeader />
        <section className="dashboard-gate">
          <p className="eyebrow">Private dashboard</p>
          <h1>Sign in to see your progress.</h1>
          <p>Your typing practice is still available without an account.</p>
          <div className="gate-actions">
            <AuthControls />
            <Link className="secondary-button" href="/">Continue as guest</Link>
          </div>
        </section>
      </main>
    );
  }

  return <AuthenticatedDashboard key={user.id} />;
}

function AuthenticatedDashboard() {
  const [history, setHistory] = useState<PracticeHistoryRow[]>([]);
  const [period, setPeriod] = useState<ChartPeriod>("day");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listPracticeHistory()
      .then((rows) => {
        if (active) {
          setHistory(rows);
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load the dashboard.");
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => calculateHistorySummary(history), [history]);
  const chartData = useMemo(() => aggregateHistory(history, period), [history, period]);

  return (
    <main className="dashboard-shell">
      <DashboardHeader />
      <section className="dashboard-heading">
        <div>
          <p className="eyebrow">Your practice history</p>
          <h1>Progress, one session at a time.</h1>
        </div>
        <Link className="primary-button" href="/">Start practice <span aria-hidden="true">→</span></Link>
      </section>

      {error ? <div className="dashboard-error" role="alert">{error}</div> : null}

      {isLoading ? <DashboardContentLoading /> : (
        <>
          <section className="summary-grid" aria-label="Practice summary">
            <SummaryCard label="Total practice" value={formatDuration(summary.totalSeconds)} note={`${summary.sessionCount} sessions`} />
            <SummaryCard label="Average WPM" value={summary.averageWpm.toFixed(1)} note="Across all sessions" />
            <SummaryCard label="Average accuracy" value={`${summary.averageAccuracy.toFixed(1)}%`} note="Across all sessions" />
          </section>

          <section className="dashboard-card chart-card">
            <div className="card-heading">
              <div><span>Performance</span><strong>WPM and accuracy</strong></div>
              <div className="period-tabs" aria-label="Chart grouping">
                {(["day", "week", "month"] as ChartPeriod[]).map((item) => (
                  <button className={period === item ? "active" : ""} key={item} type="button" onClick={() => setPeriod(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <DashboardChart data={chartData} />
          </section>

          <section className="dashboard-card history-card">
            <div className="card-heading"><div><span>History</span><strong>Latest sessions</strong></div></div>
            <div className="history-table-wrap">
              <table className="history-table">
                <thead><tr><th>Date</th><th>Mode</th><th>WPM</th><th>Accuracy</th><th>Source</th></tr></thead>
                <tbody>
                  {history.slice(0, 20).map((row) => (
                    <tr key={row.id}>
                      <td>{new Intl.DateTimeFormat("en", { day: "2-digit", month: "short" }).format(new Date(row.created_at))}</td>
                      <td>{row.mode} · {row.language.toUpperCase()}</td>
                      <td>{Number(row.wpm).toFixed(1)}</td>
                      <td>{Number(row.accuracy).toFixed(1)}%</td>
                      <td>{row.topic ?? "Static"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {history.length === 0 ? <p className="history-empty">Your completed sessions will appear here.</p> : null}
            </div>
            <p className="replay-note">Exact replay is unavailable because the history schema does not store the original practice text.</p>
          </section>
        </>
      )}
    </main>
  );
}

function DashboardHeader() {
  return (
    <header className="site-header dashboard-header">
      <Link className="brand" href="/" aria-label="Keysteady practice">
        <span className="brand-mark">K</span><span>keysteady</span>
      </Link>
      <div className="header-actions"><Link className="dashboard-link" href="/">Practice</Link><AuthControls /></div>
    </header>
  );
}

function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="summary-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function DashboardLoading() {
  return <main className="dashboard-shell"><DashboardHeader /><DashboardContentLoading /></main>;
}

function DashboardContentLoading() {
  return <div className="dashboard-loading" aria-label="Loading dashboard"><div /><div /><div /></div>;
}
