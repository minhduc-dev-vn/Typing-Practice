export type VietnameseInputMethod = "telex" | "vni";

export interface CompositionChange {
  backspaces: number;
  text: string;
}

type ToneName = "acute" | "grave" | "hook" | "tilde" | "dot";

const TONE_KEYS_TELEX: Record<string, ToneName> = {
  s: "acute",
  f: "grave",
  r: "hook",
  x: "tilde",
  j: "dot"
};

const TONE_KEYS_VNI: Record<string, ToneName> = {
  "1": "acute",
  "2": "grave",
  "3": "hook",
  "4": "tilde",
  "5": "dot"
};

const TONE_TABLE: Record<string, Record<ToneName, string>> = {
  a: { acute: "á", grave: "à", hook: "ả", tilde: "ã", dot: "ạ" },
  ă: { acute: "ắ", grave: "ằ", hook: "ẳ", tilde: "ẵ", dot: "ặ" },
  â: { acute: "ấ", grave: "ầ", hook: "ẩ", tilde: "ẫ", dot: "ậ" },
  e: { acute: "é", grave: "è", hook: "ẻ", tilde: "ẽ", dot: "ẹ" },
  ê: { acute: "ế", grave: "ề", hook: "ể", tilde: "ễ", dot: "ệ" },
  i: { acute: "í", grave: "ì", hook: "ỉ", tilde: "ĩ", dot: "ị" },
  o: { acute: "ó", grave: "ò", hook: "ỏ", tilde: "õ", dot: "ọ" },
  ô: { acute: "ố", grave: "ồ", hook: "ổ", tilde: "ỗ", dot: "ộ" },
  ơ: { acute: "ớ", grave: "ờ", hook: "ở", tilde: "ỡ", dot: "ợ" },
  u: { acute: "ú", grave: "ù", hook: "ủ", tilde: "ũ", dot: "ụ" },
  ư: { acute: "ứ", grave: "ừ", hook: "ử", tilde: "ữ", dot: "ự" },
  y: { acute: "ý", grave: "ỳ", hook: "ỷ", tilde: "ỹ", dot: "ỵ" }
};

const SHAPED_VOWELS = new Set(["ă", "â", "ê", "ô", "ơ", "ư"]);

function preserveCase(source: string, replacement: string): string {
  return source === source.toUpperCase() ? replacement.toUpperCase() : replacement;
}

function replacePairs(input: string, replacements: Record<string, string>): string {
  let output = "";

  for (let index = 0; index < input.length; index += 1) {
    const pair = input.slice(index, index + 2);
    const replacement = replacements[pair.toLowerCase()];
    if (replacement) {
      output += preserveCase(pair[0], replacement);
      index += 1;
    } else {
      output += input[index];
    }
  }

  return output;
}

function applyTone(input: string, tone: ToneName): string {
  const characters = Array.from(input);
  let vowelIndexes = characters
    .map((character, index) => ({ character, index }))
    .filter(({ character }) => TONE_TABLE[character.toLowerCase()])
    .map(({ index }) => index);

  if (vowelIndexes.length > 1 && characters[0]?.toLowerCase() === "q" && characters[1]?.toLowerCase() === "u") {
    vowelIndexes = vowelIndexes.filter((index) => index !== 1);
  }
  if (vowelIndexes.length > 1 && characters[0]?.toLowerCase() === "g" && characters[1]?.toLowerCase() === "i") {
    vowelIndexes = vowelIndexes.filter((index) => index !== 1);
  }
  if (vowelIndexes.length === 0) {
    return input;
  }

  const shapedIndex = vowelIndexes.find((index) => SHAPED_VOWELS.has(characters[index].toLowerCase()));
  const selectedIndex = shapedIndex ?? vowelIndexes[Math.floor((vowelIndexes.length - 1) / 2)];
  const selectedCharacter = characters[selectedIndex];
  const replacement = TONE_TABLE[selectedCharacter.toLowerCase()][tone];
  characters[selectedIndex] = preserveCase(selectedCharacter, replacement);
  return characters.join("").normalize("NFC");
}

function extractTone(input: string, toneKeys: Record<string, ToneName>): { base: string; tone?: ToneName } {
  const finalCharacter = input.at(-1)?.toLowerCase();
  const tone = finalCharacter ? toneKeys[finalCharacter] : undefined;
  return tone ? { base: input.slice(0, -1), tone } : { base: input };
}

export function convertTelex(input: string): string {
  const { base, tone } = extractTone(input, TONE_KEYS_TELEX);
  const shaped = replacePairs(base, {
    aa: "â",
    aw: "ă",
    dd: "đ",
    ee: "ê",
    oo: "ô",
    ow: "ơ",
    uw: "ư"
  });
  return tone ? applyTone(shaped, tone) : shaped.normalize("NFC");
}

export function convertVni(input: string): string {
  const { base, tone } = extractTone(input, TONE_KEYS_VNI);
  const shaped = replacePairs(base, {
    a6: "â",
    a8: "ă",
    d9: "đ",
    e6: "ê",
    o6: "ô",
    o7: "ơ",
    u7: "ư"
  });
  return tone ? applyTone(shaped, tone) : shaped.normalize("NFC");
}

export function convertVietnamese(input: string, method: VietnameseInputMethod): string {
  return method === "telex" ? convertTelex(input) : convertVni(input);
}

export class VietnameseComposer {
  private rawWord = "";
  private renderedWord = "";

  constructor(private method: VietnameseInputMethod = "telex") {}

  setMethod(method: VietnameseInputMethod): void {
    this.method = method;
    this.reset();
  }

  press(key: string): CompositionChange {
    if (/^[a-zA-Z0-9]$/u.test(key)) {
      this.rawWord += key;
      return this.reconcile(convertVietnamese(this.rawWord, this.method));
    }

    this.reset();
    return { backspaces: 0, text: key };
  }

  backspace(): CompositionChange {
    if (this.rawWord.length === 0) {
      return { backspaces: 1, text: "" };
    }

    this.rawWord = this.rawWord.slice(0, -1);
    return this.reconcile(convertVietnamese(this.rawWord, this.method));
  }

  reset(): void {
    this.rawWord = "";
    this.renderedWord = "";
  }

  private reconcile(nextRenderedWord: string): CompositionChange {
    let sharedPrefixLength = 0;
    const previousCharacters = Array.from(this.renderedWord);
    const nextCharacters = Array.from(nextRenderedWord);

    while (
      sharedPrefixLength < previousCharacters.length &&
      sharedPrefixLength < nextCharacters.length &&
      previousCharacters[sharedPrefixLength] === nextCharacters[sharedPrefixLength]
    ) {
      sharedPrefixLength += 1;
    }

    const change = {
      backspaces: previousCharacters.length - sharedPrefixLength,
      text: nextCharacters.slice(sharedPrefixLength).join("")
    };
    this.renderedWord = nextRenderedWord;
    return change;
  }
}
