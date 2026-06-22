/** Shared Deepgram listen options (live + batch). */
export const DEEPGRAM_LISTEN_OPTIONS = {
  model: "nova-3" as const,
  language: "en",
  smart_format: true,
  interim_results: true,
  utterance_end_ms: 1500,
  punctuate: true,
  numerals: true,
};
