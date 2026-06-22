import type { Tok } from "./types";

export function highlightKeywords(text: string, terms: string[]): Tok[] {
  // Longest terms first so multi-word matches win over their prefixes.
  const sorted = [...terms].filter(Boolean).sort((a, b) => b.length - a.length);
  const toks: Tok[] = [];
  let i = 0;
  let plainStart = 0;

  const pushPlain = (end: number) => {
    if (end > plainStart) toks.push({ text: text.slice(plainStart, end), k: 0 });
  };

  while (i < text.length) {
    let matched: string | null = null;
    for (const term of sorted) {
      const slice = text.slice(i, i + term.length);
      if (slice.toLowerCase() === term.toLowerCase()) {
        matched = slice; // preserve original casing
        break;
      }
    }
    if (matched) {
      pushPlain(i);
      toks.push({ text: matched, k: 1 });
      i += matched.length;
      plainStart = i;
    } else {
      i += 1;
    }
  }
  pushPlain(text.length);
  return toks.length ? toks : [{ text, k: 0 }];
}
