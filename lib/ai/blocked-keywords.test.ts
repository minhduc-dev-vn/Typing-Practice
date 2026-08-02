import { describe, expect, it } from "vitest";

import { findBlockedKeyword, normalizeForKeywordCheck } from "./blocked-keywords";

describe("blocked topic filtering", () => {
  it("matches Vietnamese topics without accents and without case sensitivity", () => {
    expect(normalizeForKeywordCheck("MA TÚY")).toBe("ma tuy");
    expect(findBlockedKeyword("Thông tin về MA TÚY")).toBe("ma tuy");
    expect(findBlockedKeyword("Hành vi tự sát")).toBe("tu sat");
  });

  it("matches basic blocked English phrases", () => {
    expect(findBlockedKeyword("A guide to explosive weapon design")).toBe("explosive weapon");
    expect(findBlockedKeyword("Preventing self harm")).toBe("self harm");
  });

  it("allows ordinary practice topics", () => {
    expect(findBlockedKeyword("A peaceful morning garden")).toBeNull();
    expect(findBlockedKeyword("Lịch sử kiến trúc Việt Nam")).toBeNull();
  });
});
