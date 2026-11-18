# Account policies and data controls

Released policy version: 2026-11-17. Project contact: varungullanki@gmail.com.

## User flow

The public homepage, authentication screens, privacy overview and Settings link to `/terms` and `/privacy-policy`. The existing `/privacy` route remains the authenticated application-board visibility prompt. Middleware now checks whole path segments so `/privacy-policy` is public.

New signups must independently confirm age 18+ and accept Terms / acknowledge Privacy Policy. Both fields are validated before calling Supabase Auth. An Auth insert trigger stores a server timestamp and the submitted policy versions in an owner-readable, non-client-writable acknowledgment table. Historical users are not backfilled as having accepted. This is a record of the signup declaration, not an authorization claim; user-editable metadata never grants access.

Settings → Your data opens inline export or deletion confirmation. Both operations require an active cookie session, enrolled MFA completion, same-origin JSON POST, and a fresh password check. Password checking uses an isolated client and its temporary session is revoked. A database-backed five-attempt/five-minute limit applies across server instances. Passwords and tokens are never logged or exported.

Export returns a no-store JSON attachment, with account-owned records and social records the user participates in. The database export helper derives the ID from auth.uid(), checks the actual active session and MFA, and uses a fixed table allowlist. There is no caller-supplied account ID and no per-table 1000-row truncation. Google credentials, session tokens, generation keys and other people's private records are excluded.

Deletion additionally requires the exact confirmation DELETE. The server disconnects/revokes Gmail, ends all Auth sessions and calls the Supabase Admin delete API for the verified user's ID. If Google revocation cannot be confirmed, the success screen tells the user to revoke CareerUp in Google account connections. A database trigger atomically cancels open pools, refunds contributions, clears the legacy non-cascading calendar FK and lets the existing FK cascades remove account records. Other participants' funded reward redemptions remain. Provider logs, backups and external applications are not claimed to be erased. If Auth deletion fails after signout, the response explains that the user must sign in and retry; it never reports a false successful deletion.

## Database rollout

`supabase/migrations/20261118032629_account_privacy_controls.sql` was created with the Supabase CLI, then applied to the linked hosted project through SQL. It adds only the acknowledgment and rate-limit tables, an owner-bound export, and new Auth insert/delete triggers. Do not reapply the non-idempotent migration to the already-updated hosted project. Apply it once when provisioning another database.

Security advisors reported no new public definer function or table policy findings for this change. Existing findings include intentional service-only tables and legacy explicitly authorized definer RPCs, plus disabled leaked-password protection. This release does not claim a clean global security audit or certify legal compliance.

## Verification

Production build and TypeScript checks pass. Disposable-account integration checks cover public policy access, protected onboarding, unchecked required signup declarations, server-side consent rejection, anonymous/cross-origin rejection, explicit deletion confirmation, password verification, private export, credentials exclusion, owner-only acknowledgment, Auth deletion, deleted-session replay rejection, global session cleanup and rate limiting.

Additional database-backed scenarios verified exports above 1000 records, stored credential-value exclusion, both pool-owner and participant deletion refunds, retention of another member's funded reward, enrolled MFA rejection through both API and direct database RPC, and removal of legacy calendar records. No real user account was deleted or exported in testing.

Reproduce the main integration suite with private environment variables loaded and the application running:

```
node scripts/prepare-account-privacy-fixture.mjs create
PRIVACY_TEST_BASE_URL=http://localhost:3217 node scripts/verify-account-privacy.mjs
node scripts/prepare-account-privacy-fixture.mjs cleanup
```

The fixture file contains randomly generated test passwords. It is ignored by Git and must be deleted by cleanup. The runner refuses users without both the fixture marker and reserved example.invalid email pattern. Admin account creation sends no email. Always run cleanup even after a failed test. Supply PRIVACY_FIXTURE_FILE and PRIVACY_RESULTS_FILE to relocate artifacts; never use a real user's account.

The additional MFA and large-export scenarios were separately exercised using temporary synthetic fixture rows and are not counted as an AI accuracy benchmark. Ordinary app feature tests do not establish legal compliance, provider policy compliance, or real-world hiring accuracy.
