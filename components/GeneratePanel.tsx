"use client";

import { useRef, useState } from "react";

import { GenerateClientError, requestGeneratedContent } from "@/lib/ai/client";
import type { ContentLength, Difficulty } from "@/lib/ai/types";
import type { TypingLanguage } from "@/lib/typing-engine/engine";

interface GeneratePanelProps {
  language: TypingLanguage;
  initialTopic?: string;
  onGenerated: (content: string[], metadata: GeneratedContentMetadata) => void;
}

export interface GeneratedContentMetadata {
  topic: string | null;
  difficulty: Difficulty;
  length: ContentLength;
}

type Status = { kind: "success" | "warning" | "error"; message: string } | null;

export function GeneratePanel({ language, initialTopic = "", onGenerated }: GeneratePanelProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [length, setLength] = useState<ContentLength>("medium");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) {
      return;
    }

    const normalizedTopic = topic.trim();
    if (normalizedTopic.length < 2) {
      setStatus({ kind: "error", message: "Nhập chủ đề có ít nhất 2 ký tự." });
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsLoading(true);
    setStatus({ kind: "warning", message: "Đang tạo bài luyện mới — lần đầu có thể mất một chút thời gian." });

    try {
      const response = await requestGeneratedContent({
        language,
        topic: normalizedTopic,
        difficulty,
        length
      }, controller.signal);
      onGenerated(response.content, {
        topic: response.fallback ? null : normalizedTopic,
        difficulty,
        length
      });
      setStatus(response.fallback
        ? { kind: "warning", message: response.message ?? "Đang dùng nội dung tĩnh." }
        : {
            kind: "success",
            message: response.cached ? "Đã tải bài từ bộ nhớ dùng chung." : "Đã tạo bài luyện mới."
          });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setStatus({
        kind: "error",
        message: error instanceof GenerateClientError
          ? error.message
          : "Kết nối bị gián đoạn. Nội dung tĩnh hiện tại vẫn dùng được."
      });
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setIsLoading(false);
      }
    }
  };

  return (
    <form className="generate-panel" onSubmit={handleSubmit} aria-label="AI content generator">
      <div className="generate-heading">
        <div>
          <span className="ai-badge">AI</span>
          <strong>Generate a focused practice</strong>
        </div>
        <span className="guest-label">Guest · 20/day</span>
      </div>

      <div className="generate-fields">
        <label className="topic-field">
          <span>Topic</span>
          <input
            type="text"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder={language === "vi" ? "Ví dụ: khu vườn buổi sáng" : "e.g. a morning garden"}
            maxLength={80}
            disabled={isLoading}
          />
        </label>

        <label>
          <span>Difficulty</span>
          <select
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as Difficulty)}
            disabled={isLoading}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>

        <label>
          <span>Length</span>
          <select
            value={length}
            onChange={(event) => setLength(event.target.value as ContentLength)}
            disabled={isLoading}
          >
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
        </label>

        <button className="generate-button" type="submit" disabled={isLoading}>
          {isLoading ? <span className="button-spinner" aria-hidden="true" /> : <span aria-hidden="true">✦</span>}
          {isLoading ? "Generating…" : "Generate"}
        </button>
      </div>

      <div className="generate-status" aria-live="polite">
        {status ? <span className={`status-${status.kind}`}>{status.message}</span> : (
          <span>AI content is optional. Static practice always remains available.</span>
        )}
      </div>
    </form>
  );
}
