export interface VirtualKeyDefinition {
  code: string;
  label: string;
  span: number;
}

const key = (code: string, label: string, span = 2): VirtualKeyDefinition => ({
  code,
  label,
  span
});

export const VIRTUAL_KEYBOARD_ROWS: readonly (readonly VirtualKeyDefinition[])[] = [
  [
    key("Escape", "Esc"),
    ...Array.from({ length: 10 }, (_, index) => key(`Digit${(index + 1) % 10}`, String((index + 1) % 10))),
    key("Minus", "-"),
    key("Equal", "="),
    key("Backspace", "Backspace", 4)
  ],
  [
    key("Tab", "Tab", 3),
    ..."QWERTYUIOP".split("").map((letter) => key(`Key${letter}`, letter)),
    key("BracketLeft", "["),
    key("BracketRight", "]"),
    key("Backslash", "\\", 3)
  ],
  [
    key("CapsLock", "Caps", 4),
    ..."ASDFGHJKL".split("").map((letter) => key(`Key${letter}`, letter)),
    key("Semicolon", ";"),
    key("Quote", "'"),
    key("Enter", "Enter", 4)
  ],
  [
    key("ShiftLeft", "Shift", 5),
    ..."ZXCVBNM".split("").map((letter) => key(`Key${letter}`, letter)),
    key("Comma", ","),
    key("Period", "."),
    key("Slash", "/"),
    key("ShiftRight", "Shift", 5)
  ],
  [
    key("ControlLeft", "Ctrl", 3),
    key("MetaLeft", "Win", 3),
    key("AltLeft", "Alt", 3),
    key("Space", "Space", 12),
    key("AltRight", "Alt", 3),
    key("ContextMenu", "Menu"),
    key("MetaRight", "Win"),
    key("ControlRight", "Ctrl")
  ]
];

const SUPPORTED_CODES = new Set(
  VIRTUAL_KEYBOARD_ROWS.flatMap((row) => row.map(({ code }) => code))
);

const CODE_ALIASES: Readonly<Record<string, string>> = {
  OSLeft: "MetaLeft",
  OSRight: "MetaRight",
  Spacebar: "Space"
};

export function normalizeVirtualKeyCode(code: string): string | null {
  const normalizedCode = CODE_ALIASES[code] ?? code;
  return SUPPORTED_CODES.has(normalizedCode) ? normalizedCode : null;
}
