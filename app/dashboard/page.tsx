"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AuthControls } from "@/components/AuthControls";
import { DashboardChart } from "@/components/DashboardChart";
import {
  addFavoriteTopic,
  listFavoriteTopics,
  listPracticeHistory,
  removeFavoriteTopic,
  updateFavoriteTopic
} from "@/lib/history/client";
import {
  aggregateHistory,
  calculateHistorySummary,
  formatDuration,
  getRecentTopics,
  type ChartPeriod
} from "@/lib/history/analytics";
import type { FavoriteTopicRow, PracticeHistoryRow } from "@/lib/history/types";
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
          <p>Your typing practice and AI generator are still available without an account.</p>
          <div className="gate-actions">
            <AuthControls />
            <Link className="secondary-button" href="/">Continue as guest</Link>
          </div>
        </section>
      </main>
    );
  }

  return <AuthenticatedDashboard key={user.id} userId={user.id} />;
}

function AuthenticatedDashboard({ userId }: { userId: string }) {
  const [history, setHistory] = useState<PracticeHistoryRow[]>([]);
  const [favorites, setFavorites] = useState<FavoriteTopicRow[]>([]);
  const [period, setPeriod] = useState<ChartPeriod>("day");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteDraft, setFavoriteDraft] = useState("");
  const [editingFavoriteId, setEditingFavoriteId] = useState<string | null>(null);
  const [editingFavoriteValue, setEditingFavoriteValue] = useState("");
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([listPracticeHistory(), listFavoriteTopics()])
      .then(([historyRows, favoriteRows]) => {
        if (active) {
          setHistory(historyRows);
          setFavorites(favoriteRows);
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Không thể tải dashboard.");
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => calculateHistorySummary(history), [history]);
  const chartData = useMemo(() => aggregateHistory(history, period), [history, period]);
  const recentTopics = useMemo(() => getRecentTopics(history), [history]);
  const favoriteKeys = useMemo(
    () => new Set(favorites.map((favorite) => favorite.topic.toLocaleLowerCase("en-US"))),
    [favorites]
  );

  const addFavorite = async (topic: string) => {
    const normalized = topic.trim();
    if (normalized.length < 2 || isMutating) {
      return;
    }
    setIsMutating(true);
    setError(null);
    try {
      const favorite = await addFavoriteTopic(userId, normalized);
      setFavorites((current) => [favorite, ...current]);
      setFavoriteDraft("");
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Không thể thêm chủ đề.");
    } finally {
      setIsMutating(false);
    }
  };

  const removeFavorite = async (favorite: FavoriteTopicRow) => {
    if (isMutating) {
      return;
    }
    setIsMutating(true);
    setError(null);
    try {
      await removeFavoriteTopic(favorite.id);
      setFavorites((current) => current.filter((item) => item.id !== favorite.id));
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Không thể xóa chủ đề.");
    } finally {
      setIsMutating(false);
    }
  };

  const updateFavorite = async (favorite: FavoriteTopicRow) => {
    const normalized = editingFavoriteValue.trim();
    if (normalized.length < 2 || isMutating) {
      return;
    }
    setIsMutating(true);
    setError(null);
    try {
      const updated = await updateFavoriteTopic(favorite.id, normalized);
      setFavorites((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingFavoriteId(null);
      setEditingFavoriteValue("");
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Không thể cập nhật chủ đề.");
    } finally {
      setIsMutating(false);
    }
  };

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

          <div className="dashboard-columns">
            <section className="dashboard-card topics-card">
              <div className="card-heading"><div><span>Topics</span><strong>Recent and favorite</strong></div></div>
              <div className="topic-section">
                <span className="section-label">Recent</span>
                <div className="topic-list">
                  {recentTopics.length === 0 ? <p className="empty-copy">AI-generated topics will appear here.</p> : recentTopics.map((topic) => (
                    <button
                      className="topic-chip"
                      type="button"
                      key={topic}
                      disabled={favoriteKeys.has(topic.toLocaleLowerCase("en-US")) || isMutating}
                      onClick={() => void addFavorite(topic)}
                      title="Add to favorites"
                    >
                      {topic}<span aria-hidden="true">☆</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="topic-section">
                <span className="section-label">Favorites</span>
                <form className="favorite-form" onSubmit={(event) => { event.preventDefault(); void addFavorite(favoriteDraft); }}>
                  <input value={favoriteDraft} maxLength={80} onChange={(event) => setFavoriteDraft(event.target.value)} placeholder="Add a topic" />
                  <button type="submit" disabled={isMutating || favoriteDraft.trim().length < 2}>Add</button>
                </form>
                <div className="favorite-list">
                  {favorites.length === 0 ? <p className="empty-copy">No favorite topics yet.</p> : favorites.map((favorite) => (
                    <div key={favorite.id}>
                      {editingFavoriteId === favorite.id ? (
                        <form className="favorite-edit" onSubmit={(event) => { event.preventDefault(); void updateFavorite(favorite); }}>
                          <input value={editingFavoriteValue} maxLength={80} onChange={(event) => setEditingFavoriteValue(event.target.value)} autoFocus />
                          <button type="submit" disabled={isMutating || editingFavoriteValue.trim().length < 2}>Save</button>
                          <button type="button" onClick={() => setEditingFavoriteId(null)}>Cancel</button>
                        </form>
                      ) : (
                        <>
                          <span>{favorite.topic}</span>
                          <span className="favorite-actions">
                            <button type="button" onClick={() => { setEditingFavoriteId(favorite.id); setEditingFavoriteValue(favorite.topic); }} disabled={isMutating}>Edit</button>
                            <button type="button" onClick={() => void removeFavorite(favorite)} disabled={isMutating} aria-label={`Remove ${favorite.topic}`}>×</button>
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="dashboard-card history-card">
              <div className="card-heading"><div><span>History</span><strong>Latest sessions</strong></div></div>
              <div className="history-table-wrap">
                <table className="history-table">
                  <thead><tr><th>Date</th><th>Mode</th><th>WPM</th><th>Accuracy</th><th>Topic</th><th /></tr></thead>
                  <tbody>
                    {history.slice(0, 20).map((row) => (
                      <tr key={row.id}>
                        <td>{new Intl.DateTimeFormat("en", { day: "2-digit", month: "short" }).format(new Date(row.created_at))}</td>
                        <td>{row.mode} · {row.language.toUpperCase()}</td>
                        <td>{Number(row.wpm).toFixed(1)}</td>
                        <td>{Number(row.accuracy).toFixed(1)}%</td>
                        <td>{row.topic ?? "Static"}</td>
                        <td><button className="replay-button" type="button" disabled title="Exact content is not stored in the Phase 3 schema">Replay unavailable</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {history.length === 0 ? <p className="history-empty">Your completed sessions will appear here.</p> : null}
              </div>
              <p className="replay-note">Exact replay is unavailable because the Phase 3 schema does not store static content or AI difficulty and length.</p>
            </section>
          </div>
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
