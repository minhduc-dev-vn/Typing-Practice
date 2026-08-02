import { create } from "zustand";

import type { TypingLanguage, TypingResult } from "@/lib/typing-engine/engine";

export type PracticeMode = "words" | "sentences" | "paragraph";
export type TimeLimit = 30 | 60 | 120;

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
