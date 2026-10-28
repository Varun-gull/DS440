# CareerUp

CareerUp is a gamified internship application tracker for students. The MVP focuses on the core solo loop: track applications, mark roles as applied, earn XP, build streaks, level up through ranks, and complete simple challenges.

## Tech Stack

- Next.js 15.5.28
- TypeScript
- Tailwind CSS
- Supabase authentication, database, and private storage
- Google GenAI SDK for optional AI chat and live voice

## MVP Screens

- Home
- Sign up
- Log in
- Dashboard
- Applications
- Add application
- Profile
- Challenges
- Leaderboard

## Application Email Scanner

Open `/applications/email-scanner` from Applications or Settings. Pasted email preview runs locally in the browser. Gmail reading and saved suggestions require the additive database migration and OAuth settings described in [the email scanner setup guide](../docs/email-scanner-setup.md).

The scanner suggests statuses and requires confirmation before changing applications. It does not send mail, award XP, or scan in the background. Run `npm run verify:email-scanner` for synthetic rule checks and `npm run verify:email-scanner:database` for isolated Docker based database checks.

## Career Assistant and Live Voice

Open `/interview/assistant` for optional AI chat, live interview practice, and an explicitly labelled offline guide. Resume sharing is off by default. Read the [assistant setup guide](../docs/career-assistant-setup.md) for private provider settings, usage limits, and verification. The assistant does not submit applications or change fit scores.

## Development Server

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## 21st.dev Components

CareerUp is configured for the shadcn-compatible 21st.dev component registry. The setup lives in `components.json`, `lib/utils.ts`, `tailwind.config.ts`, and `app/globals.css`.

To add a specific 21st.dev component, copy its registry URL from 21st.dev and run:

```bash
npx shadcn@latest add https://21st.dev/r/<component>
```

Imported registry components should go under `components/ui` and can use the shared `cn()` helper from `@/lib/utils`.

## Supabase Setup

Create `.env.local` when you have a Supabase project:

```bash
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

For a new empty project only, open Supabase SQL Editor and run:

```text
supabase/schema.sql
```

Do not rerun the base schema over the existing CareerUp database. Integration migrations are additive and described in their setup guides. The app falls back to mock data until Supabase env vars are added.

## Verify Profile Messages

To test direct profile messaging against Supabase RLS, use two confirmed test accounts and run:

```bash
CAREERUP_TEST_SENDER_EMAIL="sender@example.com" \
CAREERUP_TEST_SENDER_PASSWORD="password" \
CAREERUP_TEST_RECIPIENT_EMAIL="recipient@example.com" \
CAREERUP_TEST_RECIPIENT_PASSWORD="password" \
npm run verify:profile-messages
```

The script sends a profile-scoped message, verifies the recipient can read it, and checks the unread count used by the notification badge.

## Live Postings

The `/postings` page uses Adzuna first when `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` are set. If those keys are missing or Adzuna returns no internship-style roles, it falls back to Remotive's public API, then sample postings.
