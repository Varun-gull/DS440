# Architecture

## System Overview

```text
Browser
  │
  ▼
Next.js application
  ├── React pages and reusable components
  ├── Server actions for authenticated updates
  ├── API routes for profile/resume operations
  └── Posting search and matching logic
  │
  ├──────────────► Public GitHub job lists
  │
  ▼
Supabase
  ├── Authentication
  ├── PostgreSQL database
  ├── Row Level Security
  └── Optional posting cache
```

## Main Directories

### `app/`

Contains the Next.js App Router pages and API endpoints. Authenticated features live under `app/(shell)/`; public authentication and landing pages live directly under `app/`.

### `components/`

Contains reusable interface pieces such as the application pipeline, calendar, posting table, challenge card, leaderboard, and navigation.

### `lib/`

Contains the application logic:

- `auth/actions.ts`: signup, login, and logout
- `applications/actions.ts`: create applications, update stages, award points, and trigger calendar events
- `calendar/actions.ts`: create, move, promote, and remove recruiting events
- `data.ts`: authenticated reads from Supabase with development fallbacks
- `gamification.ts`: XP, Reward Points, challenges, and rank bonuses
- `postings.ts`: job-source parsing, search, deduplication, filtering, and fit scoring
- `postings-sync.ts`: server-side posting-cache refresh
- `resume.ts`: resume parsing, keyword extraction, and baseline tailoring suggestions
- `friends/`, `groups/`, and `messages/`: social and peer-accountability actions

### `supabase/`

`schema.sql` is the full baseline database definition. Other SQL files contain incremental migrations and feature-specific policies. Do not run migrations blindly against production; confirm whether each change is already present.

## Main Data Tables

| Table | Purpose |
| --- | --- |
| `profiles` | Student profile, resume signals, XP, points, streaks, and privacy settings |
| `applications` | Saved and submitted job applications |
| `calendar_events` | Deadlines, submissions, interviews, offers, and custom events |
| `challenges` | Active challenge definitions |
| `completed_challenges` | Challenge completion history |
| `user_rewards` | Unlockable resources purchased by each user |
| `interview_answers` | Saved STAR interview stories |
| `friends` | Friend requests and accepted connections |
| `career_groups` | Private recruiting groups |
| `career_group_members` | Group membership |
| `peer_messages` | Direct and role-related messages |
| `postings` | Optional cached internship and new-graduate postings |

## Authentication and Privacy

- Supabase handles email/password authentication.
- Middleware redirects logged-out visitors away from protected routes.
- Row Level Security limits access to user-owned records.
- Application-board sharing is optional and relationship-aware.
- The resume endpoint extracts and stores text; it does not store the uploaded file itself.
- Service-role keys must remain server-side.

## Baseline Matching Logic

The current score begins from a base value and adds points for:

- Matching a target role
- Matching a preferred location
- Matching a remote-work preference
- Matching resume keywords in a posting

The result is capped below 100 and is best described as a baseline fit signal—not a hiring probability.

## Future AI Boundary

The AI implementation should be added behind a separate server-side service with versioned prompts/models, structured outputs, logging, rate limits, and fallbacks. Keep the existing baseline available so both approaches can be tested on identical inputs.

