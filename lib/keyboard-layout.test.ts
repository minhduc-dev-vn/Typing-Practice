import { describe, expect, it } from "vitest";

import { normalizeVirtualKeyCode, VIRTUAL_KEYBOARD_ROWS } from "./keyboard-layout";

describe("virtual keyboard layout", () => {
  it("defines five complete rows with unique physical key codes", () => {
    const keys = VIRTUAL_KEYBOARD_ROWS.flat();
    const codes = keys.map(({ code }) => code);

    expect(VIRTUAL_KEYBOARD_ROWS).toHaveLength(5);
    expect(new Set(codes).size).toBe(codes.length);
    expect(VIRTUAL_KEYBOARD_ROWS.map((row) => row.reduce((total, item) => total + item.span, 0)))
      .toEqual([30, 30, 30, 30, 30]);
  });

  it("normalizes supported legacy codes and rejects keys outside the layout", () => {
    expect(normalizeVirtualKeyCode("KeyD")).toBe("KeyD");
    expect(normalizeVirtualKeyCode("OSLeft")).toBe("MetaLeft");
    expect(normalizeVirtualKeyCode("Spacebar")).toBe("Space");
    expect(normalizeVirtualKeyCode("F1")).toBeNull();
    expect(normalizeVirtualKeyCode("Numpad1")).toBeNull();
  });
});
