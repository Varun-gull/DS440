# CareerUp Rewards

## Experience

The Rewards page has Explore rewards, My rewards, Together, and Points history. A persistent balance link in the header opens the store. Every purchase previews its price and remaining balance. The server determines prices and processes a purchase and its ledger entry in one transaction. Retrying the same request does not charge again. Purchases never subtract lifetime XP or change rank.

| Reward | Price | Delivery |
| --- | ---: | --- |
| Extra live interview session | 25 RP | One extra five minute reservation after the free daily sessions |
| Detailed resume review | 35 RP | One saved Gemini report using a job description and optional, explicitly approved resume context; resume context is required for this review |
| Personal interview preparation pack | 25 RP | One saved question pack based on the supplied job description |
| Personal skill exercise | 20 RP | One saved exercise, deliverables, rubric, and self reported reflection |
| Career insights | 30 RP once | Current application stages, four weeks of activity, companies, locations, and CSV export |
| Profile Studio | 30 RP once | Three themes, four avatar styles, and an earned featured achievement |
| Planned day off | 12 RP | One protected date today or in the next week |
| Friend challenge host pass | 20 RP | A shared goal for the host and up to five accepted friends |
| Interview night pool | 20 RP per participant as a shared goal | Each participant receives an extra voice credit and a preparation pack |
| Career workshop passes | Coming soon | No booking, payment, or point redemption until a real host and event are confirmed |

Workshop partners have not been added. The store explicitly displays Coming soon and cannot charge points for that item. No external messaging, event registration, payment, or promise of a real workshop is made.

## Points and activity

The migration preserves all existing displayed points in a separate, protected wallet and retains previous resource unlocks. Opening points are recorded separately from newly earned points. Existing XP and rank behavior remains separate. Wallet tables cannot be read or written directly by browser roles. The authoritative balance is not mirrored back into the legacy public profile field; app screens read the protected wallet. Existing code no longer uses an XP deduction as a fallback for point spending.

Activity is recorded from database changes, with unique event keys to prevent duplicate credit for status toggles and repeated copies of the same company, role, and recruiting year. Saving a distinct role earns 1 RP, recording an application earns 4, an interview stage earns 3, an offer stage earns 10, a first complete profile earns 6, and a first resume earns 8. A complete STAR practice answer earns 6 RP for each distinct prompt per Eastern calendar day. An unlocked skill exercise earns 4 RP once when the student saves a reflection. New earning is capped at 30 RP per Eastern calendar day. This cap applies to earning, not spending or refunds.

Application and exercise completion are self reported. A saved STAR answer must have meaningful text in all four sections, but the system does not claim to verify its truth or quality. Friend challenges share aggregate progress after each participant joins. They do not award additional points or allow point wagers. Old milestone cards continue to describe XP; the recorded underlying activity awards RP separately.

Recent unused consumables can be returned within seven days. Permanently unlocked tools are available immediately and are not refundable. AI generation failure leaves the purchased tool unused, so it can be retried or returned if still eligible. Preparing a purchased report does not consume daily chat messages. Reports load only when opened, rather than sending every stored report with each wallet refresh. The library includes the 250 most recent reward records plus permanent unlocks; voice credit totals are counted independently across all unused credits. Ledger history displays the latest 60 entries.

## Streaks and live voice

Planned day passes cover up to two days in any rolling seven day period. They do not add XP or application counts, create a streak, or repair an already missed unprotected day. A protected gap preserves the existing streak until the next recorded application. Protection is reflected in private profile, friend, group, and leaderboard streak counts without exposing other students' protected dates. Earlier free or paid revive inventory is retained under its existing rules.

Live voice uses the three free daily reservations first. Further sessions consume one unused reward credit, with a total safety cap of ten sessions per UTC day and no overlapping sessions. Microphone permission is requested before reserving a session. If Google token creation fails, the reservation and any paid credit are restored. A successfully issued token is a used reservation, even if a later browser or network problem interrupts the connection. The permanent provider key stays on the server.

## Friends and shared pools

Only accepted friends can be invited. Invitations appear inside Rewards and require each participant to accept. No email is sent. A goal has a target of 1 to 20 activities and a seven or fourteen day duration. Participants may leave; the host may end it. If no friend joined before it ends, the unused hosting pass becomes available again.

A pool supports two to six participants, with a shared target of 20 RP per member and a fourteen day contribution window. Contributions stay closed until everyone accepts. Each contribution is an atomic balance debit with an idempotency key. Reaching the target grants both rewards to every participant in the same transaction. Any member may cancel an unfinished pool, returning each contribution exactly once. The interface offers cancellation after an unfunded pool expires. Deleting a member's account also cancels unfinished pools and returns other members' held contributions. Already delivered rewards remain available to surviving members.

## Privacy and access

`/api/rewards` verifies the signed in user and enrolled MFA for reads, purchases, refunds, saved report access, and community actions. Writes require the site's exact origin. The client cannot choose another wallet owner or set prices. All new wallet, report, preference, activity, and community tables have RLS enabled and no browser role grants. The server filters every read and write by the verified user or a community record in which that user participates. Privileged RPCs are executable only by the service role. Trigger functions live in a private schema with fixed search paths and restricted execution privileges.

AI tools require explicit Google processing consent. Saved resume context is off by default, contact patterns are redacted where possible, and a job description is required. Reports are saved privately; they are guidance and do not change the resume, fit score, application status, or hiring eligibility. Raw provider errors, prompts, and permanent credentials are not sent to the client. Appearance preferences affect the student's own pages. Points have no cash value and require no payment.

## Deployment and verification

Apply the additive migrations in order:

1. `supabase/migrations/20261104232035_rewards_studio.sql`
2. `supabase/migrations/20261104235817_reward_pool_member_cleanup.sql`
3. `supabase/migrations/20261105001028_private_reward_balances.sql`

The existing Supabase and Gemini server variables are used. No new paid service is required. Both production projects use the original CareerUp repository. The DS440 copy contains the same reward logic with its existing layout preserved.

Run `npm run verify:rewards`, `npm run verify:rewards:database`, `npm run verify:assistant`, and `npm run build`. The database checks start an isolated temporary PostgreSQL Docker container. They verify concurrent spending, double submits, refunds, ownership, earning caps, voice credit consumption, pool delivery, and account deletion cleanup.

With a local app at `http://127.0.0.1:3211`, run `npm run verify:rewards:live`. It uses the ignored `.env.local`, creates disposable synthetic users, and deletes them afterward. Set `CAREERUP_PRIVATE_ENV` to an alternative ignored environment file if needed. Set `CAREERUP_TEST_REWARD_AI=true` to include actual Gemini report and paid voice token requests using synthetic data. Production testing additionally requires `CAREERUP_REWARDS_TEST_URL` and `CAREERUP_ALLOW_DEPLOYED_TESTS=true`.

Browser checks cover purchase confirmation, library delivery, persistent appearance, report preparation, and phone layout. Automated voice tests check provider tokens and audio separately; they do not establish a successful microphone session on every student's browser. Functional checks do not measure whether rewards improve motivation; that requires the planned student study.
