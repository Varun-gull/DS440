# CareerUp

CareerUp is an interactive career development platform for students. It combines job postings, application tracking, profiles, interview preparation, progress systems, challenges, rewards, messaging, and calendar tools in one website.

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Supabase authentication, database access, and row security policies

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

## Run Locally

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

## Supabase Connection

Create `.env.local` and add the values from the existing CareerUp Supabase project:

```bash
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

The existing Supabase project already contains the live CareerUp data. The SQL files in `supabase/` document the schema and later feature updates. For a completely new database, begin with:

```text
supabase/schema.sql
```

The app falls back to mock data when the Supabase environment variables are unavailable.

## Vercel Deployment

Connect Vercel to the DS440 GitHub repository and set the project root directory to `frontend`. Add the same Supabase environment variables in the Vercel project settings before deploying. If the public website address changes, add the new address to the allowed redirect URLs in Supabase Authentication settings.

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
