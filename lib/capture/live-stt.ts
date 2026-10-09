import { FAKE_TRANSCRIPT } from "@/lib/stt/fake";

export type LiveCreds =
  | { provider: "fake" }
  | { provider: "deepgram"; scheme: "bearer" | "token"; token: string };

export type LiveParse = { text: string; isFinal: boolean };

export type LiveSession = {
  send: (data: Blob) => void;
  close: () => Promise<string>;
};

export function parseDeepgramLiveMessage(raw: unknown): LiveParse | null {
  if (!raw || typeof raw !== "object") return null;
  const msg = raw as {
    is_final?: boolean;
    channel?: { alternatives?: { transcript?: string }[] };
  };
  const text = msg.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
  if (!text) return null;
  return { text, isFinal: Boolean(msg.is_final) };
}

function joinUtterance(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return `${a} ${b}`;
}

export function accumulateLiveText(
  finals: string,
  _interim: string,
  next: LiveParse,
): { finals: string; interim: string; display: string } {
  const nextFinals = next.isFinal ? joinUtterance(finals, next.text) : finals;
  const nextInterim = next.isFinal ? "" : next.text;
  return {
    finals: nextFinals,
    interim: nextInterim,
    display: joinUtterance(nextFinals, nextInterim),
  };
}

export function fakeTranscriptAt(elapsedMs: number, script: string, msPerWord = 280): string {
  const words = script.split(/\s+/).filter(Boolean);
  const n = Math.min(words.length, Math.max(1, Math.floor(elapsedMs / msPerWord) + 1));
  return words.slice(0, n).join(" ");
}

export async function fetchLiveCreds(): Promise<LiveCreds> {
  const res = await fetch("/api/stt/live");
  if (!res.ok) throw new Error(`live creds failed: ${res.status}`);
  return (await res.json()) as LiveCreds;
}

export function connectLiveSession(
  creds: LiveCreds,
  onDisplay: (text: string) => void,
  keywords: string[] = [],
): LiveSession {
  if (creds.provider === "fake") {
    const started = Date.now();
    const timer = setInterval(() => {
      onDisplay(fakeTranscriptAt(Date.now() - started, FAKE_TRANSCRIPT));
    }, 140);
    return {
      send() {},
      async close() {
        clearInterval(timer);
        onDisplay(FAKE_TRANSCRIPT);
        return FAKE_TRANSCRIPT;
      },
    };
  }

  const params = new URLSearchParams({
    model: "nova-2",
    smart_format: "true",
    punctuate: "true",
    interim_results: "true",
    utterance_end_ms: "1000",
  });
  for (const kw of keywords) params.append("keywords", kw);

  const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, [creds.scheme, creds.token]);
  const queued: ArrayBuffer[] = [];
  let finals = "";
  let interim = "";
  let closed = false;

  ws.onopen = () => {
    for (const buf of queued) ws.send(buf);
    queued.length = 0;
  };
  ws.onmessage = (ev) => {
    if (typeof ev.data !== "string") return;
    try {
      const parsed = parseDeepgramLiveMessage(JSON.parse(ev.data));
      if (!parsed) return;
      const next = accumulateLiveText(finals, interim, parsed);
      finals = next.finals;
      interim = next.interim;
      onDisplay(next.display);
    } catch {
      /* ignore keepalives / malformed frames */
    }
  };

  return {
    send(data) {
      void data.arrayBuffer().then((buf) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(buf);
        else if (ws.readyState === WebSocket.CONNECTING) queued.push(buf);
      });
    },
    close() {
      return new Promise((resolve) => {
        if (closed) {
          resolve(joinUtterance(finals, interim));
          return;
        }
        closed = true;
        const finish = () => {
          try {
            ws.close();
          } catch {
            /* already closed */
          }
          resolve(joinUtterance(finals, interim));
        };
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: "CloseStream" }));
          } catch {
            /* ignore */
          }
          setTimeout(finish, 450);
        } else {
          finish();
        }
      });
    },
  };
}
