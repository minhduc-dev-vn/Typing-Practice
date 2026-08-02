export default function Loading() {
  return (
    <main className="app-shell" aria-label="Loading typing practice">
      <div className="loading-header" />
      <section className="loading-panel">
        <div className="loading-line loading-line-short" />
        <div className="loading-line loading-line-title" />
        <div className="loading-controls" />
        <div className="loading-copy" />
      </section>
    </main>
  );
}
