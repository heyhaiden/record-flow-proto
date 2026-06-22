import { DeepgramClient } from "@deepgram/sdk";
import { DEEPGRAM_LISTEN_OPTIONS } from "./deepgram-config";

export type DeepgramAuthMode = "bearer" | "api_key";

type ListenV1 = DeepgramClient["listen"]["v1"] & {
  createConnection: (
    args: typeof DEEPGRAM_LISTEN_OPTIONS,
  ) => ReturnType<DeepgramClient["listen"]["v1"]["connect"]>;
};

export type DeepgramLiveSocket = Awaited<ReturnType<ListenV1["createConnection"]>>;

const SOCKET_OPEN = 1;

export function isDeepgramSocketOpen(socket: DeepgramLiveSocket | null | undefined): boolean {
  return socket?.readyState === SOCKET_OPEN;
}

/** Send audio only when the live socket is open — avoids "Socket is not open" races on mobile. */
export function sendDeepgramLiveAudio(socket: DeepgramLiveSocket | null | undefined, data: Blob): boolean {
  if (!isDeepgramSocketOpen(socket)) return false;
  try {
    socket!.sendMedia(data);
    return true;
  } catch {
    return false;
  }
}

export async function openDeepgramLiveConnection(
  credential: string,
  authMode: DeepgramAuthMode,
): Promise<DeepgramLiveSocket> {
  const client = new DeepgramClient(
    authMode === "api_key" ? { apiKey: credential } : { accessToken: credential },
  );
  const socket = await (client.listen.v1 as ListenV1).createConnection(DEEPGRAM_LISTEN_OPTIONS);
  socket.connect();
  await socket.waitForOpen();
  return socket;
}

export function closeDeepgramLiveConnection(socket: DeepgramLiveSocket | null): void {
  if (!socket) return;
  try {
    if (isDeepgramSocketOpen(socket)) {
      socket.sendCloseStream({ type: "CloseStream" });
    }
  } catch {
    /* ignore — socket may already be closing */
  }
  try {
    socket.close();
  } catch {
    /* ignore */
  }
}
