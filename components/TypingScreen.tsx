"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { AuthControls } from "@/components/AuthControls";
import { ResultScreen } from "@/components/ResultScreen";
import { VirtualKeyboard } from "@/components/VirtualKeyboard";
import { KeySoundPlayer } from "@/lib/audio/key-sound";
import {
  MAX_CUSTOM_TEXT_LENGTH,
  createPracticeText,
  normalizeCustomPracticeText
} from "@/lib/content";
import { savePracticeSession } from "@/lib/history/client";
import { CountdownTimer } from "@/lib/typing-engine/countdown";
import {
  DEFAULT_TYPING_LINE_COLUMNS,
  findActiveTypingLine,
  splitTypingDisplayLines
} from "@/lib/typing-engine/display-lines";
import { TypingEngine } from "@/lib/typing-engine/engine";
import {
  MAX_TIME_LIMIT_SECONDS,
  MIN_TIME_LIMIT_SECONDS,
  parseTimeLimit,
  useTypingStore,
  type PracticeMode,
  type TimeLimit
} from "@/store/typingStore";
import { useAuthStore } from "@/store/authStore";

type Theme = "light" | "dark";
type HistorySaveStatus = "idle" | "saving" | "saved" | "error";

const MODE_LABELS: Record<PracticeMode, string> = {
  words: "Words",
  paragraph: "Paragraph",
  custom: "Custom"
};

const BLOCKED_NAVIGATION_KEYS = new Set(["ArrowDown", "ArrowLeft", "ArrowUp"]);
const QUICK_TIME_OPTIONS: ReadonlyArray<{ value: TimeLimit; label: string }> = [
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 60, label: "60s" }
];

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
  const [customTimeDraft, setCustomTimeDraft] = useState("");
  const [typingLineColumns, setTypingLineColumns] = useState(DEFAULT_TYPING_LINE_COLUMNS);
  const [theme, setTheme] = useState<Theme>("dark");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [customText, setCustomText] = useState("");
  const [customTextDraft, setCustomTextDraft] = useState("");
  const [isCustomEditorOpen, setIsCustomEditorOpen] = useState(true);
  const [historySaveStatus, setHistorySaveStatus] = useState<HistorySaveStatus>("idle");

  const nativeInputRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  const compositionTextRef = useRef("");
  const pendingCommittedTextRef = useRef("");
  const characterRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const wordOverflowRefs = useRef(new Map<number, HTMLSpanElement>());
  const typingLinesContainerRef = useRef<HTMLDivElement>(null);
  const typingLineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const activeTypingLineRef = useRef(-1);
  const engineRef = useRef<TypingEngine | null>(null);
  const timerRef = useRef<CountdownTimer | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const keySoundRef = useRef<KeySoundPlayer | null>(null);
  const customTextInputRef = useRef<HTMLTextAreaElement>(null);
  const historySaveTokenRef = useRef(0);

  const targetText = useMemo(
    () => mode === "custom"
      ? customText
      : createPracticeText(mode, language, sessionSeed),
    [customText, language, mode, sessionSeed]
  );
  const targetCharacters = useMemo(() => Array.from(targetText.normalize("NFC")), [targetText]);
  const hasPracticeText = targetCharacters.length > 0;
  const isPracticeReady = hasPracticeText && (mode !== "custom" || !isCustomEditorOpen);
  const typingLines = useMemo(
    () => splitTypingDisplayLines(targetText, typingLineColumns),
    [targetText, typingLineColumns]
  );
  const wordOverflowAnchors = useMemo(() => new Set(
    [
      ...targetCharacters.flatMap((character, index) => /\s/u.test(character) ? [index] : []),
      targetCharacters.length
    ]
  ), [targetCharacters]);

  const syncTypingLine = useCallback((currentIndex: number, force = false) => {
    const activeLine = findActiveTypingLine(typingLines, currentIndex);
    if (!force && activeTypingLineRef.current === activeLine) {
      return;
    }

    activeTypingLineRef.current = activeLine;
    typingLineRefs.current.forEach((element, index) => {
      if (!element) {
        return;
      }

      element.classList.remove(
        "typing-line-active",
        "typing-line-preview",
        "typing-line-previous",
        "typing-line-hidden"
      );
      if (index === activeLine) {
        element.classList.add("typing-line-active");
      } else if (index === activeLine + 1) {
        element.classList.add("typing-line-preview");
      } else if (index < activeLine) {
        element.classList.add("typing-line-previous");
      } else {
        element.classList.add("typing-line-hidden");
      }
      element.setAttribute("aria-hidden", String(index !== activeLine));
    });

  }, [typingLines]);

  useLayoutEffect(() => {
    const container = typingLinesContainerRef.current;
    if (!container) {
      return;
    }

    const updateColumnCount = () => {
      if (useTypingStore.getState().isRunning) {
        return;
      }

      const probe = document.createElement("span");
      probe.textContent = "0000000000";
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.style.whiteSpace = "pre";
      container.appendChild(probe);
      const characterWidth = probe.getBoundingClientRect().width / 10;
      probe.remove();

      if (characterWidth <= 0) {
        return;
      }

      const measuredColumns = Math.max(
        20,
        Math.floor(container.getBoundingClientRect().width / characterWidth) - 1
      );
      setTypingLineColumns((currentColumns) => (
        currentColumns === measuredColumns ? currentColumns : measuredColumns
      ));
    };

    updateColumnCount();
    const observer = new ResizeObserver(updateColumnCount);
    observer.observe(container);
    return () => observer.disconnect();
  }, [isPracticeReady]);

  const syncOrLoopTypingContent = useCallback((completed: boolean) => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }

    if (completed && engine.continueFromStart()) {
      syncTypingLine(0, true);
      return;
    }

    syncTypingLine(engine.getSnapshot().currentIndex);
  }, [syncTypingLine]);

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
      void savePracticeSession({ userId: user.id, mode, language, topic: null, result })
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
  }, [finishSession, language, mode, stopTimer]);

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
    isComposingRef.current = false;
    compositionTextRef.current = "";
    pendingCommittedTextRef.current = "";
    characterRefs.current = characterRefs.current.slice(0, targetCharacters.length);
    typingLineRefs.current = typingLineRefs.current.slice(0, typingLines.length);
    activeTypingLineRef.current = -1;

    const engine = new TypingEngine(targetText);
    engine.attachElements(characterRefs.current);
    engine.attachOverflowElements(wordOverflowRefs.current);
    engineRef.current = engine;
    syncTypingLine(0, true);

    const focusFrame = requestAnimationFrame(() => {
      if (isPracticeReady) {
        nativeInputRef.current?.focus();
      }
    });
    return () => {
      cancelAnimationFrame(focusFrame);
      stopTimer();
    };
  }, [isPracticeReady, sessionSeed, stopTimer, syncTypingLine, targetCharacters.length, targetText, typingLines.length]);

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

  const flushNativeInput = useCallback((input: HTMLTextAreaElement) => {
    const engine = engineRef.current;
    if (!engine) {
      input.value = "";
      return;
    }

    let text = input.value.normalize("NFC");
    input.value = "";
    const committedText = pendingCommittedTextRef.current;
    pendingCommittedTextRef.current = "";
    if (committedText && text.startsWith(committedText)) {
      text = text.slice(committedText.length);
    }
    if (!text) {
      return;
    }

    beginSession();
    const operation = engine.onTextInput(text);
    syncOrLoopTypingContent(operation.completed);
    if (process.env.NODE_ENV === "development" && operation.latencyMs >= 16) {
      console.warn(`Typing update exceeded one frame: ${operation.latencyMs.toFixed(3)} ms`);
    }
  }, [beginSession, syncOrLoopTypingContent]);

  const applyCompositionUpdate = useCallback((nextText: string) => {
    const engine = engineRef.current;
    if (!engine) {
      return false;
    }

    const normalizedText = nextText.normalize("NFC");
    const operation = engine.onCompositionUpdate(compositionTextRef.current, normalizedText);
    compositionTextRef.current = normalizedText;
    syncTypingLine(engine.getSnapshot().currentIndex);
    if (process.env.NODE_ENV === "development" && operation.latencyMs >= 16) {
      console.warn(`IME composition update exceeded one frame: ${operation.latencyMs.toFixed(3)} ms`);
    }
    return operation.completed;
  }, [syncTypingLine]);

  const handleNativeInput = useCallback((event: React.FormEvent<HTMLTextAreaElement>) => {
    const nativeEvent = event.nativeEvent as InputEvent;
    if (isComposingRef.current || nativeEvent.isComposing) {
      applyCompositionUpdate(event.currentTarget.value);
      return;
    }
    flushNativeInput(event.currentTarget);
  }, [applyCompositionUpdate, flushNativeInput]);

  const handleCompositionEnd = useCallback((event: React.CompositionEvent<HTMLTextAreaElement>) => {
    const completed = applyCompositionUpdate(event.data);
    isComposingRef.current = false;
    compositionTextRef.current = "";
    pendingCommittedTextRef.current = event.data.normalize("NFC");
    event.currentTarget.value = "";
    syncOrLoopTypingContent(completed);
  }, [applyCompositionUpdate, syncOrLoopTypingContent]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (finalResult) {
      return;
    }

    if (isComposingRef.current || event.nativeEvent.isComposing) {
      beginSession();
      keySoundRef.current?.play(event.key === "Backspace" ? "backspace" : "key");
      return;
    }

    if (BLOCKED_NAVIGATION_KEYS.has(event.key) || (event.key === "ArrowRight" && (
      event.ctrlKey || event.metaKey || event.altKey
    ))) {
      event.preventDefault();
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const engine = engineRef.current;
    if (!engine) {
      return;
    }

    let handled = false;
    let completed = false;

    if (event.key === "ArrowRight") {
      handled = true;
      beginSession();
      completed = engine.skipCurrentWord().completed;
    } else if (event.key === "Backspace") {
      if (event.currentTarget.value.length > 0) {
        beginSession();
        keySoundRef.current?.play("backspace");
        return;
      }
      handled = true;
      beginSession();
      completed = engine.onBackspace().completed;
    } else {
      const producesNativeInput = Array.from(event.key).length === 1 || [
        "Dead",
        "Enter",
        "Process",
        "Unidentified"
      ].includes(event.key);
      if (producesNativeInput) {
        beginSession();
        keySoundRef.current?.play("key");
      }
      return;
    }

    if (!handled) {
      return;
    }

    event.preventDefault();
    syncOrLoopTypingContent(completed);
    keySoundRef.current?.play(event.key === "Backspace" ? "backspace" : "key");
  }, [beginSession, finalResult, syncOrLoopTypingContent]);

  const prepareNewSession = useCallback((refreshText = true) => {
    historySaveTokenRef.current += 1;
    stopTimer();
    startedAtRef.current = null;
    isComposingRef.current = false;
    compositionTextRef.current = "";
    pendingCommittedTextRef.current = "";
    if (nativeInputRef.current) {
      nativeInputRef.current.value = "";
    }
    resetSession();
    setRemainingSeconds(timeLimit);
    setHistorySaveStatus("idle");
    if (refreshText) {
      setSessionSeed((seed) => seed + 1);
    } else {
      engineRef.current?.reset();
      syncTypingLine(0, true);
    }
  }, [resetSession, stopTimer, syncTypingLine, timeLimit]);

  const handleModeChange = (nextMode: PracticeMode) => {
    setMode(nextMode);
    if (nextMode === "custom" && customText.length === 0) {
      setIsCustomEditorOpen(true);
      requestAnimationFrame(() => customTextInputRef.current?.focus());
    }
    prepareNewSession();
  };

  const handleLanguageChange = (nextLanguage: "en" | "vi") => {
    setLanguage(nextLanguage);
    prepareNewSession();
  };

  const handleTimeChange = (nextTimeLimit: TimeLimit) => {
    setTimeLimit(nextTimeLimit);
    prepareNewSession(false);
    setRemainingSeconds(nextTimeLimit);
  };

  const handleQuickTimeChange = (nextTimeLimit: TimeLimit) => {
    setCustomTimeDraft("");
    handleTimeChange(nextTimeLimit);
  };

  const applyCustomTime = () => {
    const normalizedTime = parseTimeLimit(customTimeDraft);

    if (normalizedTime === null) {
      const isQuickTime = QUICK_TIME_OPTIONS.some(({ value }) => value === timeLimit);
      setCustomTimeDraft(isQuickTime ? "" : String(timeLimit));
      return;
    }

    setCustomTimeDraft(String(normalizedTime));
    if (normalizedTime !== timeLimit) {
      handleTimeChange(normalizedTime);
    }
  };

  const applyCustomText = () => {
    const normalizedText = normalizeCustomPracticeText(customTextDraft);
    if (normalizedText.length < 2 || normalizedText.length > MAX_CUSTOM_TEXT_LENGTH) {
      return;
    }

    setCustomText(normalizedText);
    setCustomTextDraft(normalizedText);
    setIsCustomEditorOpen(false);
    prepareNewSession();
  };

  const openCustomEditor = () => {
    prepareNewSession(false);
    setCustomTextDraft(customText);
    setIsCustomEditorOpen(true);
    requestAnimationFrame(() => customTextInputRef.current?.focus());
  };

  const handleNewStaticText = () => {
    prepareNewSession();
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

      <div className="practice-layout">
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
            {QUICK_TIME_OPTIONS.map(({ value, label }) => (
              <button
                className={timeLimit === value ? "control-option active" : "control-option"}
                key={value}
                type="button"
                onClick={() => handleQuickTimeChange(value)}
              >
                {label}
              </button>
            ))}
            <label
              className={QUICK_TIME_OPTIONS.some(({ value }) => value === timeLimit)
                ? "custom-time-control"
                : "custom-time-control active"}
              title="Enter 10 to 3600 seconds"
            >
              <input
                aria-label="Custom practice time in seconds"
                className="custom-time-input"
                inputMode="numeric"
                max={MAX_TIME_LIMIT_SECONDS}
                min={MIN_TIME_LIMIT_SECONDS}
                onBlur={applyCustomTime}
                onChange={(event) => setCustomTimeDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    const isQuickTime = QUICK_TIME_OPTIONS.some(({ value }) => value === timeLimit);
                    setCustomTimeDraft(isQuickTime ? "" : String(timeLimit));
                    event.currentTarget.blur();
                  }
                }}
                placeholder="Custom"
                step={1}
                type="number"
                value={customTimeDraft}
              />
              <span aria-hidden="true">s</span>
            </label>
          </ControlGroup>

        </div>

        {mode === "custom" ? (
          isCustomEditorOpen ? (
            <form
              className="custom-text-panel custom-text-panel-expanded"
              onSubmit={(event) => {
                event.preventDefault();
                applyCustomText();
              }}
            >
              <div className="custom-text-heading">
                <div>
                  <strong>Your practice text</strong>
                  <span>Paste or type any content you want to practise.</span>
                </div>
                <span>{customTextDraft.length.toLocaleString()} / {MAX_CUSTOM_TEXT_LENGTH.toLocaleString()}</span>
              </div>
              <textarea
                aria-label="Custom practice text"
                className="custom-text-editor"
                maxLength={MAX_CUSTOM_TEXT_LENGTH}
                onChange={(event) => setCustomTextDraft(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    applyCustomText();
                  }
                }}
                placeholder="Paste or type the text you want to practise..."
                ref={customTextInputRef}
                spellCheck={false}
                value={customTextDraft}
              />
              <div className="custom-text-actions">
                <span><kbd>Ctrl</kbd> + <kbd>Enter</kbd> to apply</span>
                <div>
                  {customText.length > 0 ? (
                    <button
                      className="custom-text-secondary"
                      onClick={() => {
                        setCustomTextDraft(customText);
                        setIsCustomEditorOpen(false);
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                  ) : null}
                  <button
                    className="custom-text-primary"
                    disabled={normalizeCustomPracticeText(customTextDraft).length < 2}
                    type="submit"
                  >
                    Use this text
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="custom-text-panel custom-text-summary">
              <div>
                <strong>Custom text ready</strong>
                <span>{customText.length.toLocaleString()} characters</span>
              </div>
              <button className="custom-text-secondary" onClick={openCustomEditor} type="button">
                Edit text
              </button>
            </div>
          )
        ) : null}

        {isPracticeReady ? (
          <>
            <div
              className="typing-area"
              onClick={() => nativeInputRef.current?.focus()}
            >
              <textarea
                aria-label="Typing practice input. Uses the active operating system keyboard and input method."
                autoCapitalize="off"
                autoComplete="off"
                className="typing-native-input"
                onCompositionEnd={handleCompositionEnd}
                onCompositionUpdate={(event) => {
                  applyCompositionUpdate(event.data);
                }}
                onCompositionStart={() => {
                  isComposingRef.current = true;
                  compositionTextRef.current = "";
                  pendingCommittedTextRef.current = "";
                  beginSession();
                }}
                onDrop={(event) => event.preventDefault()}
                onInput={handleNativeInput}
                onKeyDown={handleKeyDown}
                onPaste={(event) => event.preventDefault()}
                ref={nativeInputRef}
                spellCheck={false}
              />
              <div className="typing-lines" ref={typingLinesContainerRef}>
                {typingLines.map((line, lineIndex) => (
                  <div
                    aria-hidden={lineIndex !== 0}
                    className={lineIndex === 0
                      ? "typing-line typing-line-active"
                      : lineIndex === 1
                        ? "typing-line typing-line-preview"
                        : "typing-line typing-line-hidden"}
                    data-line-index={lineIndex}
                    key={`${sessionSeed}-line-${line.start}`}
                    ref={(element) => {
                      typingLineRefs.current[lineIndex] = element;
                    }}
                  >
                    {targetCharacters.slice(line.start, line.end).map((character, offset) => {
                      const index = line.start + offset;
                      return (
                        <Fragment key={`${sessionSeed}-${index}`}>
                          <span
                            className={character === "\n"
                              ? "typing-character typing-character-newline char-pending"
                              : "typing-character char-pending"}
                            data-index={index}
                            ref={(element) => {
                              characterRefs.current[index] = element;
                            }}
                          >
                            {character === "\n" ? "↵" : character}
                          </span>
                          {wordOverflowAnchors.has(index + 1) ? (
                            <span
                              className="typing-word-overflow"
                              data-word-end={index + 1}
                              ref={(element) => {
                                if (element) {
                                  wordOverflowRefs.current.set(index + 1, element);
                                } else {
                                  wordOverflowRefs.current.delete(index + 1);
                                }
                              }}
                            />
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <VirtualKeyboard />

            <div className="practice-footer">
              <span className="keyboard-hint"><kbd>Space</kbd> commit <kbd>→</kbd> skip</span>
              <span className="start-hint">{isRunning ? "Stay with the rhythm" : "Start typing when you are ready"}</span>
              <button className="text-button" type="button" onClick={handleNewStaticText}>
                {mode === "custom" ? "Restart" : "New text"}
              </button>
            </div>
          </>
        ) : !hasPracticeText ? (
          <div className="custom-text-empty" role="status">
            Paste your text above, then select <strong>Use this text</strong> to begin.
          </div>
        ) : null}
        </section>

      </div>
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
