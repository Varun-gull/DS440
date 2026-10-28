# CareerUp assistant and voice setup

Paths beginning with `frontend/` refer to the DS440 repository. In the standalone CareerUp repository, omit that prefix.

## Implemented behavior

Open `/interview/assistant` from Interview or Settings. Students can select a cached job or paste a job description, optionally include their own saved resume, and ask for career guidance. Resume context is off by default. Contact patterns are redacted where possible; this is not guaranteed anonymization. The assistant explains the existing evidence coverage score and cannot alter it, send email, submit applications, or change application statuses.

AI text uses the Google GenAI SDK on the server. Live interview practice uses a single use provider token, a five minute session cap, microphone mute and stop controls, interruptions, and live captions. The permanent API key never goes to the browser. Audio uses 16 kHz PCM input and 24 kHz output. Leaving the page or switching tabs stops the microphone. Microphone permission and provider consent are required. Browser dictation and read aloud are separate optional controls, with browser speech processing disclosed.

An explicitly labelled offline guide offers fixed templates and evidence explanations without an AI provider. It is not a generative model. AI failures remain visible and do not silently become offline replies.

## Configuration

Use Node.js 24 and the existing Supabase project. Apply `frontend/supabase/career-assistant.sql` once to add the isolated usage table and reservation function. The migration is idempotent. Do not rerun the application's base schema over an existing database.

Set these only in the application's ignored `.env.local` and the hosting project's production environment:

```text
SUPABASE_SERVICE_ROLE_KEY=existing project server key
GEMINI_API_KEY=private Gemini API key
APP_BASE_URL=https://your-careerup-domain.example
CAREERUP_CHAT_MODEL=gemini-3.5-flash-lite
CAREERUP_VOICE_MODEL=gemini-3.8-live
CAREERUP_VOICE_ENABLED=true
```

Use the exact site origin for `APP_BASE_URL`; use `http://localhost:3000` during local development. Preview deployments need their own origin configuration. Model availability and quotas depend on the Google project and API account. Verify access in that account before promising availability. A free API tier is not an assurance of confidential processing; review provider terms before sending real resumes or speech. No billing account or paid plan is created by this setup.

`node scripts/setup-integrations.mjs --origin https://your-careerup-domain.example --enable-voice` prepares private local settings and creates a fresh email encryption key if missing. It preserves nonempty credentials and prints readiness only. Add actual Google and Gemini credentials privately. Never prefix server secrets with `NEXT_PUBLIC_`. Never commit an environment file or paste keys in a chat.

Each existing Vercel project needs its own `APP_BASE_URL` and `EMAIL_SCANNER_BASE_URL`. For Gmail, register each callback URL in the same Google OAuth web client:

```text
https://careerup-smoky.vercel.app/api/email-scanner/callback
https://careerup-internship-tracker.vercel.app/api/email-scanner/callback
```

The Gmail integration is configured separately in [email-scanner-setup.md](email-scanner-setup.md). Students must personally approve their mailbox connection. A chatbot key does not authorize Gmail access.

## Privacy, authorization, and limits

The server verifies the signed in user, checks enrolled MFA, and loads only that user's selected resume context. Chat requests have a same origin check, a bounded JSON body, alternating user/assistant roles, maximum message lengths, and no caller supplied system messages. Job descriptions and resumes are marked as untrusted content in model instructions. These mitigations reduce risk but do not guarantee prompt injection immunity.

Chats, audio, and captions are not persisted by CareerUp. Page memory clears on reload. Google still processes AI content under its own terms. The isolated service only usage table stores daily counts and a voice reservation expiry, not transcripts. Atomic reservations limit each account to 50 text requests and three voice sessions per UTC day; text calls have a short cooldown and voice sessions cannot overlap. Failed calls may use a reservation. Account limits do not replace provider billing controls or prevent abuse through multiple accounts. Usage limits must be configured before enabling the provider.

## Verification

```text
npm ci
npm run verify:assistant
npm run verify:email-scanner
npm run verify:email-scanner:database
npm run verify:fit-score
npm run build
npm audit
```

Database tests use a temporary isolated PostgreSQL Docker container. `npm run verify:integrations` requires the private Supabase server settings and a running app at `http://127.0.0.1:3210`. Start that app with its base origins set to the same localhost address. The script creates two disposable synthetic accounts, checks isolation and explicit email confirmation, verifies enrolled MFA protection, and deletes the accounts afterward. It never sends or reads real email. If a Gemini key exists, it additionally tests an actual chat reply and a restricted live connection returning audio. Without a key, those provider tests explicitly skip.

To verify the existing production site after a deployment, run:

```text
CAREERUP_TEST_BASE_URL=https://careerup-smoky.vercel.app CAREERUP_ALLOW_DEPLOYED_TESTS=true npm run verify:integrations
```

Separately test the actual microphone, interrupt/mute/stop behavior, permission denial, and Google OAuth with an approved test mailbox. A passing build or synthetic test does not establish those browser/provider flows are fully functional.

Official references: [Google GenAI SDK](https://googleapis.github.io/js-genai/), [Live API overview](https://ai.google.dev/gemini-api/docs/live), [ephemeral tokens](https://ai.google.dev/gemini-api/docs/ephemeral-tokens), and [Gemini API terms](https://ai.google.dev/gemini-api/terms).
