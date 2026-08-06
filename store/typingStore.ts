import { create } from "zustand";

import type { TypingLanguage, TypingResult } from "@/lib/typing-engine/engine";

export type PracticeMode = "words" | "paragraph" | "custom";
export type TimeLimit = number;
export const MIN_TIME_LIMIT_SECONDS = 10;
export const MAX_TIME_LIMIT_SECONDS = 3_600;

export function parseTimeLimit(value: string): TimeLimit | null {
  if (value.trim() === "") {
    return null;
  }

  const parsedTime = Number(value);
  if (
    !Number.isFinite(parsedTime)
    || parsedTime < MIN_TIME_LIMIT_SECONDS
    || parsedTime > MAX_TIME_LIMIT_SECONDS
  ) {
    return null;
  }

  return Math.round(parsedTime);
}

interface TypingState {
  mode: PracticeMode;
  language: TypingLanguage;
  timeLimit: TimeLimit;
  isRunning: boolean;
  finalResult: TypingResult | null;
  setMode: (mode: PracticeMode) => void;
  setLanguage: (language: TypingLanguage) => void;
  setTimeLimit: (timeLimit: TimeLimit) => void;
  startSession: () => void;
  finishSession: (result: TypingResult) => void;
  resetSession: () => void;
}

export const useTypingStore = create<TypingState>((set) => ({
  mode: "words",
  language: "en",
  timeLimit: 60,
  isRunning: false,
  finalResult: null,
  setMode: (mode) => set({ mode, isRunning: false, finalResult: null }),
  setLanguage: (language) => set({ language, isRunning: false, finalResult: null }),
  setTimeLimit: (timeLimit) => set({ timeLimit, isRunning: false, finalResult: null }),
  startSession: () => set({ isRunning: true, finalResult: null }),
  finishSession: (finalResult) => set({ isRunning: false, finalResult }),
  resetSession: () => set({ isRunning: false, finalResult: null })
}));
