"use client";

import { useCallback, useEffect, useRef } from "react";

import { normalizeVirtualKeyCode, VIRTUAL_KEYBOARD_ROWS } from "@/lib/keyboard-layout";

export function VirtualKeyboard() {
  const keyElementsRef = useRef(new Map<string, HTMLSpanElement>());

  const releaseAllKeys = useCallback(() => {
    for (const element of keyElementsRef.current.values()) {
      element.classList.remove("is-pressed");
    }
  }, []);

  useEffect(() => {
    const setPressed = (code: string, pressed: boolean) => {
      const normalizedCode = normalizeVirtualKeyCode(code);
      if (!normalizedCode) {
        return;
      }
      keyElementsRef.current.get(normalizedCode)?.classList.toggle("is-pressed", pressed);
    };

    const handleKeyDown = (event: KeyboardEvent) => setPressed(event.code, true);
    const handleKeyUp = (event: KeyboardEvent) => setPressed(event.code, false);
    const handleVisibilityChange = () => {
      if (document.hidden) {
        releaseAllKeys();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseAllKeys);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseAllKeys);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseAllKeys();
    };
  }, [releaseAllKeys]);

  return (
    <section className="virtual-keyboard" aria-label="Live physical keyboard visualization">
      <div className="virtual-keyboard-heading">
        <span>Live keyboard</span>
        <span className="virtual-keyboard-status">
          <i aria-hidden="true" /> Physical input
        </span>
      </div>
      <div className="virtual-keyboard-case" aria-hidden="true">
        {VIRTUAL_KEYBOARD_ROWS.map((row, rowIndex) => (
          <div className="virtual-keyboard-row" key={rowIndex}>
            {row.map(({ code, label, span }) => (
              <span
                className={`virtual-key virtual-key-span-${span}`}
                data-key-code={code}
                key={code}
                ref={(element) => {
                  if (element) {
                    keyElementsRef.current.set(code, element);
                  } else {
                    keyElementsRef.current.delete(code);
                  }
                }}
              >
                {label}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
