# Automatic Gmail application tracking

The Gmail connection now supports explicit opt-in automatic application board changes. Enable it in Applications → Email scanner after connecting Gmail. Existing accounts and new connections start with automation off. An independent checkbox and consent timestamp record permission for automatic board changes; a Gmail read grant alone is not treated as that permission.

New Gmail connections default to the current recruiting cycle: July 1 through today, using America/New_York calendar dates. January through June belongs to the cycle that began the previous July. The scanner also supports custom ranges up to two years and the original 7/30/90-day windows. Existing connections keep their previous scope until the user selects a cycle. Imported cycle cards use the July start year as application_year, including January–June follow-up messages, so the same company/role can be tracked separately in successive cycles. A custom range crossing July assigns each email to its own cycle.

The application board checks the connection when opened. When enabled and visible, it processes one batch of up to 20 matching Gmail messages, continues remaining pages every 30 seconds, and starts a new scan after five minutes. The scanner page can also continue a historical import automatically, with pause/resume controls. It saves the exact query, cursor, date range, cumulative messages checked and completion time. Failed batches do not advance the checkpoint. Closed or hidden pages pause processing; this is browser-active synchronization, not an always-running mailbox watcher. Gmail OAuth test-user restrictions still apply.

Gmail search, MIME decoding and deterministic status extraction are shared with manual scanning. Google receives no mail content for AI inference. Explicit company/role pairs can create previously untracked applications. Existing matches need specific role evidence or an exact normalized identity. Case, company suffixes, and common AI/ML wording are normalized. Multiple matches across recruiting cycles require review. No company or role is invented from a generic newsletter or recruiting vendor address.

The template parser recognizes position-of confirmations (SmartRecruiters), employer interest confirmations and role-specific rejections (Lever), Comeet titles in subjects, DoorDash role-at-employer messages, PwC job-application updates and HRT internship rejections. It handles wrapped lines and HTML entities. A generic applying subject cannot override a rejection in the current message. Sent mail, drafts and self-sent replies are excluded, along with common job-alert subjects. A Workday email that does not clearly identify the employer remains for review rather than using Workday as the company. A different explicit job title cannot attach to an existing card just because the roles share words.

Parser version 3 restarts an outdated scan window and rechecks pending records with older analyses. The existing record is updated in place only when its parser version advances or its extracted identity/status changes. Confirmed or dismissed records are never reclassified. Unchanged pending analyses keep their review reasons. The explicit Sync Gmail button requests a fresh scan, subject to the existing 20-second scan lease cooldown. Automatic checks retain the five-minute interval. Sync messages include the selected dates, cumulative messages checked and the total emails still needing review. A complete search means every matching page was scanned; it does not guarantee every employer template was recognized.

The existing scan lease protects Gmail batch/cursor persistence. A separate authenticated database RPC applies pending Gmail updates in received-time order under a per-mailbox lock. It derives the account from auth.uid(), checks the active session and enrolled MFA, and verifies automatic permission while holding the connection lock. Ownership cannot be supplied by the caller. A repeated request skips already handled rows. Disconnecting or disabling automation serializes on the same connection row.

Each automatic change records its source suggestion, previous status, timestamp and automatic flag. Email timestamps are separate from board modification timestamps, so newly imported old receipts can be followed by newer interview messages in the same historical scan. Older messages cannot overwrite newer manual edits. Applied receipts do not regress interviews, and conflicting terminal outcomes remain in review. New cards do not copy mailbox excerpts, private sender fields or email bodies into shared application notes. Imported cards use “Location not provided,” “Imported from Gmail” and “Fit not scored” instead of fabricating those values. Existing friend board sharing settings apply to the resulting cards.

Automatic writes deliberately skip reward activity triggers, so scanning creates no XP, streak or Reward Point credit. The review queue can create a new card after the user supplies or corrects the company, role and cycle year, or update an existing application. An authenticated owner-only RPC locks the review record and profile, prevents duplicate company/role/cycle cards, and records the decision. Reviewed imports also award no points. Disabling controls and pasted-message review remain available.

## Verification

Run with private environment variables loaded:

```
node --experimental-strip-types scripts/verify-gmail-automation.mjs
node --experimental-strip-types scripts/verify-gmail-cycle.mjs
node --experimental-strip-types scripts/verify-gmail-board-live.mjs
node --experimental-strip-types --conditions=react-server scripts/verify-email-scanner.mjs
```

The automation runner contains 31 checks and the parser runner contains 40 checks. The recruiting-cycle runner adds 36 checks for local date boundaries, July/January rollover, historical pagination, cross-cycle isolation, real-template regressions and manual review creation. The HTTP runner verifies actual route-to-board behavior with 17 checks. Database fixtures use disposable accounts and remove them in finally blocks. These behavior checks are not an estimate of real-world classification accuracy. A live Gmail delivery test still requires a working Google authorization.

Apply the migrations `20261118035420_gmail_board_automation.sql`, `20261118042536_gmail_sync_template_retry.sql` and `20261118172110_gmail_recruiting_cycle_backfill.sql` in order once when provisioning a new database. The linked hosted database has already been updated through SQL. The migrations preserve hardened ownership/session controls; they do not grant browser access to mailbox credentials or reward writes. Public wrapper RPCs remain security invoker; privileged implementation stays in the private schema.
