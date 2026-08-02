"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AuthControls } from "@/components/AuthControls";
import { DailyPracticeBanner } from "@/components/DailyPracticeBanner";
import { GeneratePanel, type GeneratedContentMetadata } from "@/components/GeneratePanel";
import { ResultScreen } from "@/components/ResultScreen";
import { KeySoundPlayer } from "@/lib/audio/key-sound";
import { createGeneratedPracticeText, createPracticeText } from "@/lib/content";
import { savePracticeSession } from "@/lib/history/client";
import { CountdownTimer } from "@/lib/typing-engine/countdown";
import { TypingEngine } from "@/lib/typing-engine/engine";
import {
  VietnameseComposer,
  type CompositionChange,
  type VietnameseInputMethod
} from "@/lib/typing-engine/vietnamese";
import { useTypingStore, type PracticeMode, type TimeLimit } from "@/store/typingStore";
import { useAuthStore } from "@/store/authStore";

type Theme = "light" | "dark";
type HistorySaveStatus = "idle" | "saving" | "saved" | "error";

const MODE_LABELS: Record<PracticeMode, string> = {
  words: "Words",
  sentences: "Sentences",
  paragraph: "Paragraph"
};

export function TypingScreen() {
  const mode = useTypingStore((state) => state.mode);
  const language = useTypingStore((state) => state.language);
  const timeLimit = useTypingStore((state) => state.timeLimit);
  const isRunning = useTypingStore((state) => state.isRunning);
  const finalResult = useTypingStore((state) => state.finalResult);
  const setMode = useTypingStore((state) => state.setMode);
  const setLanguage = useTypingStore((state) => state.setLanguage);
  const setTimeLimit = useTypingStore((state) => state.setTimeLimit);
  const startSession = useTypingStore((state) => state.startSession);
  const finishSession = useTypingStore((state) => state.finishSession);
  const resetSession = useTypingStore((state) => state.resetSession);
  const authUser = useAuthStore((state) => state.user);

  const [sessionSeed, setSessionSeed] = useState(1);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(timeLimit);
  const [theme, setTheme] = useState<Theme>("dark");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [inputMethod, setInputMethod] = useState<VietnameseInputMethod>("telex");
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [suggestedTopic, setSuggestedTopic] = useState("");
  const [suggestionRevision, setSuggestionRevision] = useState(0);
  const [historySaveStatus, setHistorySaveStatus] = useState<HistorySaveStatus>("idle");

  const containerRef = useRef<HTMLDivElement>(null);
  const characterRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const engineRef = useRef<TypingEngine | null>(null);
  const timerRef = useRef<CountdownTimer | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const composerRef = useRef(new VietnameseComposer(inputMethod));
  const keySoundRef = useRef<KeySoundPlayer | null>(null);
  const historySaveTokenRef = useRef(0);

  const targetText = useMemo(
    () => generatedText ?? createPracticeText(mode, language, timeLimit, sessionSeed),
    [generatedText, language, mode, sessionSeed, timeLimit]
  );
  const targetCharacters = useMemo(() => Array.from(targetText), [targetText]);

  const stopTimer = useCallback(() => {
    timerRef.current?.stop();
    timerRef.current = null;
  }, []);

  const completeSession = useCallback((elapsedMs: number) => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }

    if (useTypingStore.getState().finalResult) {
      return;
    }

    engine.setEnabled(false);
    stopTimer();
    const result = engine.getResult(language, elapsedMs);
    const user = useAuthStore.getState().user;
    if (user) {
      const saveToken = ++historySaveTokenRef.current;
      setHistorySaveStatus("saving");
      void savePracticeSession({ userId: user.id, mode, language, topic: currentTopic, result })
        .then(() => {
          if (historySaveTokenRef.current === saveToken) {
            setHistorySaveStatus("saved");
          }
        })
        .catch(() => {
          if (historySaveTokenRef.current === saveToken) {
            setHistorySaveStatus("error");
          }
        });
    }
    finishSession(result);
  }, [currentTopic, finishSession, language, mode, stopTimer]);

  const beginSession = useCallback(() => {
    if (useTypingStore.getState().isRunning) {
      return;
    }

    startedAtRef.current = performance.now();
    startSession();
    const timer = new CountdownTimer(
      timeLimit,
      (remaining) => setRemainingSeconds(Math.ceil(remaining)),
      () => completeSession(timeLimit * 1000)
    );
    timerRef.current = timer;
    timer.start();
  }, [completeSession, startSession, timeLimit]);

  useEffect(() => {
    stopTimer();
    startedAtRef.current = null;
    composerRef.current.reset();
    characterRefs.current = characterRefs.current.slice(0, targetCharacters.length);

    const engine = new TypingEngine(targetText);
    engine.attachElements(characterRefs.current);
    engineRef.current = engine;

    const focusFrame = requestAnimationFrame(() => containerRef.current?.focus());
    return () => {
      cancelAnimationFrame(focusFrame);
      stopTimer();
    };
  }, [sessionSeed, stopTimer, targetCharacters.length, targetText]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("typing-theme");
    const nextTheme = savedTheme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    const themeFrame = requestAnimationFrame(() => setTheme(nextTheme));
    return () => cancelAnimationFrame(themeFrame);
  }, []);

  useEffect(() => {
    const player = new KeySoundPlayer();
    const enabled = window.localStorage.getItem("typing-sound-enabled") === "true";
    player.setEnabled(enabled);
    keySoundRef.current = player;
    const preferenceFrame = requestAnimationFrame(() => setSoundEnabled(enabled));

    return () => {
      cancelAnimationFrame(preferenceFrame);
      keySoundRef.current = null;
      player.dispose();
    };
  }, []);

  const applyCompositionChange = useCallback((change: CompositionChange) => {
    const engine = engineRef.current;
    if (!engine) {
      return false;
    }

    for (let index = 0; index < change.backspaces; index += 1) {
      engine.onBackspace();
    }

    let completed = false;
    for (const character of change.text) {
      const operation = engine.onKeyPress(character);
      completed = operation.completed;
      if (process.env.NODE_ENV === "development" && operation.latencyMs >= 16) {
        console.warn(`Typing update exceeded one frame: ${operation.latencyMs.toFixed(3)} ms`);
      }
    }
    return completed;
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (finalResult || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const engine = engineRef.current;
    if (!engine) {
      return;
    }

    let handled = false;
    let completed = false;

    if (event.key === "Backspace") {
      handled = true;
      beginSession();
      completed = language === "vi"
        ? applyCompositionChange(composerRef.current.backspace())
        : engine.onBackspace().completed;
    } else {
      const character = event.key === "Enter" ? "\n" : event.key;
      if (Array.from(character).length === 1) {
        handled = true;
        beginSession();
        completed = language === "vi"
          ? applyCompositionChange(composerRef.current.press(character))
          : engine.onKeyPress(character).completed;
      }
    }

    if (!handled) {
      return;
    }

    event.preventDefault();
    keySoundRef.current?.play(event.key === "Backspace" ? "backspace" : "key");
    if (completed) {
      const elapsedMs = startedAtRef.current === null
        ? 0
        : performance.now() - startedAtRef.current;
      completeSession(elapsedMs);
    }
  }, [applyCompositionChange, beginSession, completeSession, finalResult, language]);

  const prepareNewSession = useCallback(() => {
    historySaveTokenRef.current += 1;
    stopTimer();
    startedAtRef.current = null;
    composerRef.current.reset();
    resetSession();
    setRemainingSeconds(timeLimit);
    setHistorySaveStatus("idle");
    setSessionSeed((seed) => seed + 1);
  }, [resetSession, stopTimer, timeLimit]);

  const handleModeChange = (nextMode: PracticeMode) => {
    setGeneratedText(null);
    setCurrentTopic(null);
    setMode(nextMode);
    prepareNewSession();
  };

  const handleLanguageChange = (nextLanguage: "en" | "vi") => {
    setGeneratedText(null);
    setCurrentTopic(null);
    setLanguage(nextLanguage);
    prepareNewSession();
  };

  const handleTimeChange = (nextTimeLimit: TimeLimit) => {
    setGeneratedText(null);
    setCurrentTopic(null);
    setTimeLimit(nextTimeLimit);
    prepareNewSession();
    setRemainingSeconds(nextTimeLimit);
  };

  const handleInputMethodChange = (method: VietnameseInputMethod) => {
    setInputMethod(method);
    composerRef.current.setMethod(method);
    prepareNewSession();
  };

  const handleGenerated = useCallback((content: string[], metadata: GeneratedContentMetadata) => {
    historySaveTokenRef.current += 1;
    stopTimer();
    startedAtRef.current = null;
    composerRef.current.reset();
    resetSession();
    setRemainingSeconds(timeLimit);
    setHistorySaveStatus("idle");
    setGeneratedText(createGeneratedPracticeText(content, mode));
    setCurrentTopic(metadata.topic);
    setSessionSeed((seed) => seed + 1);
  }, [mode, resetSession, stopTimer, timeLimit]);

  const handleNewStaticText = () => {
    setGeneratedText(null);
    setCurrentTopic(null);
    prepareNewSession();
  };

  const handleUseSuggestedTopic = (topic: string) => {
    setSuggestedTopic(topic);
    setSuggestionRevision((revision) => revision + 1);
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>(".generate-panel input")?.focus();
    });
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("typing-theme", nextTheme);
  };

  const toggleSound = () => {
    const nextEnabled = !soundEnabled;
    setSoundEnabled(nextEnabled);
    keySoundRef.current?.setEnabled(nextEnabled);
    window.localStorage.setItem("typing-sound-enabled", String(nextEnabled));
  };

  if (finalResult) {
    return (
      <main className="app-shell">
        <Header
          theme={theme}
          soundEnabled={soundEnabled}
          onToggleTheme={toggleTheme}
          onToggleSound={toggleSound}
        />
        <ResultScreen
          result={finalResult}
          onRestart={prepareNewSession}
          isAuthenticated={Boolean(authUser)}
          historySaveStatus={historySaveStatus}
        />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Header
        theme={theme}
        soundEnabled={soundEnabled}
        onToggleTheme={toggleTheme}
        onToggleSound={toggleSound}
      />

      <DailyPracticeBanner onUseTopic={handleUseSuggestedTopic} />

      <section className="practice-panel" aria-labelledby="practice-heading">
        <div className="practice-intro">
          <div>
            <p className="eyebrow">Focused practice</p>
            <h1 id="practice-heading">Type at the speed of thought.</h1>
          </div>
          <div className={isRunning ? "timer timer-running" : "timer"} aria-live="polite">
            <span>Time</span>
            <strong>{remainingSeconds}</strong>
          </div>
        </div>

        <div className="controls" aria-label="Practice settings">
          <ControlGroup label="Mode">
            {(Object.keys(MODE_LABELS) as PracticeMode[]).map((item) => (
              <button
                className={mode === item ? "control-option active" : "control-option"}
                key={item}
                type="button"
                onClick={() => handleModeChange(item)}
              >
                {MODE_LABELS[item]}
              </button>
            ))}
          </ControlGroup>

          <ControlGroup label="Language">
            <button
              className={language === "en" ? "control-option active" : "control-option"}
              type="button"
              onClick={() => handleLanguageChange("en")}
            >
              English
            </button>
            <button
              className={language === "vi" ? "control-option active" : "control-option"}
              type="button"
              onClick={() => handleLanguageChange("vi")}
            >
              Tiếng Việt
            </button>
          </ControlGroup>

          <ControlGroup label="Time">
            {([30, 60, 120] as TimeLimit[]).map((seconds) => (
              <button
                className={timeLimit === seconds ? "control-option active" : "control-option"}
                key={seconds}
                type="button"
                onClick={() => handleTimeChange(seconds)}
              >
                {seconds}s
              </button>
            ))}
          </ControlGroup>

          {language === "vi" ? (
            <ControlGroup label="Input">
              {(["telex", "vni"] as VietnameseInputMethod[]).map((method) => (
                <button
                  className={inputMethod === method ? "control-option active" : "control-option"}
                  key={method}
                  type="button"
                  onClick={() => handleInputMethodChange(method)}
                >
                  {method.toUpperCase()}
                </button>
              ))}
            </ControlGroup>
          ) : null}
        </div>

        <GeneratePanel
          key={suggestionRevision}
          language={language}
          initialTopic={suggestedTopic}
          onGenerated={handleGenerated}
        />

        <div
          className="typing-area"
          ref={containerRef}
          tabIndex={0}
          role="textbox"
          aria-label="Typing practice text. Start typing to begin the timer."
          aria-multiline="true"
          onKeyDown={handleKeyDown}
          onClick={() => containerRef.current?.focus()}
        >
          {targetCharacters.map((character, index) => (
            <span
              className="typing-character char-pending"
              data-index={index}
              key={`${sessionSeed}-${index}`}
              ref={(element) => {
                characterRefs.current[index] = element;
              }}
            >
              {character}
            </span>
          ))}
        </div>

        <div className="practice-footer">
          <span className="keyboard-hint"><kbd>Tab</kbd> focus</span>
          <span className="start-hint">{isRunning ? "Stay with the rhythm" : "Start typing when you are ready"}</span>
          <button className="text-button" type="button" onClick={handleNewStaticText}>
            New text
          </button>
        </div>
      </section>
    </main>
  );
}

interface HeaderProps {
  theme: Theme;
  soundEnabled: boolean;
  onToggleTheme: () => void;
  onToggleSound: () => void;
}

function Header({ theme, soundEnabled, onToggleTheme, onToggleSound }: HeaderProps) {
  return (
    <header className="site-header">
      <a className="brand" href="#practice-heading" aria-label="Keysteady home">
        <span className="brand-mark">K</span>
        <span>keysteady</span>
      </a>
      <div className="header-actions">
        <AuthControls />
        <button
          className="sound-button"
          type="button"
          aria-pressed={soundEnabled}
          onClick={onToggleSound}
        >
          <span aria-hidden="true">{soundEnabled ? "♪" : "♩"}</span>
          {soundEnabled ? "Sound" : "Muted"}
        </button>
        <button className="theme-button" type="button" onClick={onToggleTheme}>
          <span aria-hidden="true">{theme === "dark" ? "☼" : "☾"}</span>
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>
    </header>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="control-group">
      <span className="control-label">{label}</span>
      <div className="control-options">{children}</div>
    </div>
  );
}
