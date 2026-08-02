"use client";

import { motion } from "framer-motion";

import type { TypingResult } from "@/lib/typing-engine/engine";

interface ResultScreenProps {
  result: TypingResult;
  onRestart: () => void;
  isAuthenticated: boolean;
  historySaveStatus: "idle" | "saving" | "saved" | "error";
}

function formatMetric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function ResultScreen({ result, onRestart, isAuthenticated, historySaveStatus }: ResultScreenProps) {
  const metrics = [
    { label: "WPM", value: formatMetric(result.wpm), featured: true },
    { label: "Accuracy", value: `${formatMetric(result.accuracy)}%` },
    { label: "CPM", value: formatMetric(result.cpm) },
    { label: "Errors", value: String(result.errors) }
  ];

  return (
    <motion.section
      className="result-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      aria-labelledby="result-heading"
    >
      <p className="eyebrow">Session complete</p>
      <h1 id="result-heading">Good rhythm. Keep building it.</h1>
      <div className="result-grid">
        {metrics.map((metric) => (
          <div className={metric.featured ? "metric metric-featured" : "metric"} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
      <div className="result-meta">
        <span>{formatMetric(result.durationSeconds)} seconds</span>
        <span>{result.correctCharacters} correct characters</span>
        <span>Peak latency {result.maxLatencyMs.toFixed(3)} ms</span>
      </div>
      <div className="history-save-note" aria-live="polite">
        {!isAuthenticated ? "Đăng nhập để lưu lại lịch sử luyện tập" : null}
        {isAuthenticated && historySaveStatus === "saving" ? "Đang lưu kết quả…" : null}
        {isAuthenticated && historySaveStatus === "saved" ? "Kết quả đã được lưu vào lịch sử." : null}
        {isAuthenticated && historySaveStatus === "error" ? "Không thể lưu kết quả; phiên luyện vẫn hoàn tất bình thường." : null}
      </div>
      <button className="primary-button" type="button" onClick={onRestart} autoFocus>
        Try again
        <span aria-hidden="true">↵</span>
      </button>
    </motion.section>
  );
}
