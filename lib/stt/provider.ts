export interface SttOptions {
  keywords?: string[];
  mimeType?: string;
}

export interface SttResult {
  text: string;
}

export interface SttProvider {
  transcribe(audio: Uint8Array, opts?: SttOptions): Promise<SttResult>;
}
