/**
 * Merge streaming STT segments. Deepgram may send incremental finals or
 * cumulative transcripts — this avoids duplicated words at boundaries.
 */
export function mergeTranscript(accumulated: string, incoming: string): string {
  const inc = incoming.trim();
  if (!inc) return accumulated.trim();
  const acc = accumulated.trim();
  if (!acc) return inc;
  if (inc === acc) return acc;
  if (inc.startsWith(acc)) return inc;
  if (acc.startsWith(inc)) return acc;
  if (acc.endsWith(inc)) return acc;
  if (inc.endsWith(acc)) return inc;

  const accWords = acc.split(/\s+/);
  const incWords = inc.split(/\s+/);
  const maxOverlap = Math.min(accWords.length, incWords.length);
  for (let n = maxOverlap; n > 0; n--) {
    const accTail = accWords.slice(-n).join(" ");
    const incHead = incWords.slice(0, n).join(" ");
    if (accTail === incHead) {
      return `${acc} ${incWords.slice(n).join(" ")}`.replace(/\s+/g, " ").trim();
    }
  }

  return `${acc} ${inc}`.replace(/\s+/g, " ").trim();
}
