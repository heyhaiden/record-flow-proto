# Record Flow Proto

Field-recording PWA for UK ecologists: press-and-hold to capture voice notes, which are transcribed and highlighted against a domain vocabulary (UKHab species, protected-species triggers, habitat types).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Speech-to-text

The STT provider is selected via environment variable. Copy `.env.example` to `.env.local` and configure:

| Variable | Values | Notes |
|---|---|---|
| `STT_PROVIDER` | `fake` (default) · `deepgram` | `fake` returns a scripted transcript with no API key required |
| `DEEPGRAM_API_KEY` | your key | Required only when `STT_PROVIDER=deepgram` |

With `STT_PROVIDER=fake` you can develop and test the full UI flow without a Deepgram account.

## M1 scope: push-to-talk only

**Hold** the mic button to start recording. **Release** to send the audio to `/api/transcribe` and append the highlighted transcript to the note list.

Hands-free double-tap, offline mode, LLM field extraction (M2), and Drive/email integration (M4) are deferred to later milestones.

## Tests

```bash
npm test        # Vitest unit + integration tests
npm run build   # TypeScript type check + Next.js production build
```
