# CareerUp email scanner

Paths beginning with `frontend/` refer to the DS440 repository. In the standalone CareerUp repository, omit that prefix.

## What is implemented

The scanner is available at `/applications/email-scanner`, linked from Applications and Settings. It supports local pasted email preview, storing suggestions, optional Gmail connection, manual scanning, choosing a tracked application, explicit confirmation, dismissal, recent decision history, disconnect, and deletion of scanner records. The existing application board remains the source of truth.

Status detection uses deterministic phrase rules, not an external AI service. It recognizes application receipts, interview invitations, offers, and rejection language. It removes common quoted reply history, checks negation, avoids classifying reply subjects alone, and rejects conflicting terminal outcomes. Company and role matching uses normalized phrases and token overlap. Match confidence is a heuristic, not a probability or measured accuracy. Sender domains are hints, not proof of authenticity. Unrecognized language, attachments, and unusual email layouts can require manual review.

No automatic replies, sending, message deletion, read markers, background scans, automatic calendar changes, XP awards, or streak changes are implemented by this scanner. No chatbot or voice service is needed.

## Local setup

1. Use the existing Supabase project, or preferably a separate test project for initial verification. Apply only `frontend/supabase/email-scanner.sql` in its SQL editor. The migration assumes the existing `profiles` and `applications` tables. Do not rerun `schema.sql` over an existing project.
2. In Google Cloud, create a project and enable the Gmail API. Configure the OAuth consent screen with an accurate app name, support contact, and the restricted `https://www.googleapis.com/auth/gmail.readonly` scope. During development use your own designated test mailbox, populated with synthetic application emails.
3. Create a Web application OAuth client. Register `http://localhost:3000/api/email-scanner/callback` as the local authorized redirect URI. For production register `https://YOUR_DOMAIN/api/email-scanner/callback` separately.
4. Add the following server settings to `frontend/.env.local` and, when deploying, to the hosting project's environment settings. Do not commit the file. Existing Supabase public URL and anon key settings remain required for authentication.

```text
SUPABASE_SERVICE_ROLE_KEY=your existing test project service role key
GOOGLE_CLIENT_ID=your Google OAuth client ID
GOOGLE_CLIENT_SECRET=your Google OAuth client secret
EMAIL_SCANNER_BASE_URL=http://localhost:3000
EMAIL_SCANNER_ENCRYPTION_KEY=your fresh 32 byte base64 encryption key
```

Generate the encryption key privately with `openssl rand -base64 32`. Do not paste it into a chat or public issue. Use the exact site origin for `EMAIL_SCANNER_BASE_URL`, without a path, query, or fragment. Production must use HTTPS. None of the secret settings may have a `NEXT_PUBLIC_` prefix. Keep the encryption key stable; rotating or losing it requires disconnecting and reconnecting mailboxes. Do not reuse previously disclosed credentials.

5. Restart the frontend with `npm run dev`, sign in, complete MFA if enrolled, open Applications, and choose Email scanner. Read the disclosure, select its checkbox, and choose Connect Gmail. Existing Google sign in for Supabase does not grant this separate mailbox connection automatically.
6. Scan a 7, 30, or 90 day window. Each batch lists at most 20 candidate messages. Choose Scan next batch until complete. A new scan resets to a new fixed search window. Failed batches do not advance the checkpoint. Wait at least 20 seconds between batch requests. The hosting function must support up to 60 seconds for a scan; longer account scans are intentionally split into batches.

## Data flow and safeguards

The browser sends authenticated, same origin requests to Next.js server routes. Routes validate the Supabase session and MFA assurance before processing any stored email data. Google authorization uses a short lived encrypted HttpOnly cookie, random state bound to the CareerUp user, and PKCE. Redirect addresses come from explicit server configuration rather than a caller supplied URL.

Refresh credentials are encrypted with AES 256 GCM, authenticated against their owning user ID, and stored in `email_connections`. Access tokens are used only in server memory. Connection records have RLS enabled and no grants for anonymous or ordinary authenticated database clients. The service role must never be sent to the browser.

Gmail scanning searches by a bounded date window and application phrases, then fetches candidate messages. Although CareerUp narrows requests, Gmail read permission itself covers the mailbox broadly. Users must understand this before connecting. Attachments are ignored and no full body is stored. No email content is sent to an external language model. Adding an AI provider later requires another privacy and Google policy review.

`email_updates` stores the owning user, hashed provider message key, hashed thread key, source, subject, sender, received date, suggested status, evidence excerpt of at most 400 characters, optional company and role hints, a date text hint, and the review decision. These fields still contain personal data and must be treated accordingly. Thread hashes are retained for provenance only; they do not automatically select applications. Only the owner can read records; friends and public profiles cannot access them. Up to 80 pending records and the 20 most recent decisions are displayed. Review pending items to reveal additional older suggestions.

Gmail keys include the connected address and message ID to avoid collisions between mailboxes. A database lease prevents overlapping scans. Batch insertion and cursor persistence are transactional. Disconnect and import lock the same connection so an in flight import cannot recreate mail after disconnect.

Confirmation uses the authenticated `confirm_email_update` database function. It locks the suggestion and application, checks ownership, enforces enrolled MFA, requires the exact displayed application status and timestamp, and rejects already reviewed suggestions. Older messages require separate acknowledgement. The application change and previous status audit commit together. The scanner never rewards repeated receipt emails with XP or changes the student's submission statistics. It changes application status only, not historical calendar event records. Users can correct an accepted status through the normal board controls.

Scanner records expire after 30 days and are physically removed when that user next loads the scanner. This is lazy cleanup, not a guaranteed scheduled erasure deadline. A disconnected mailbox's Gmail records and stored credential are deleted immediately, while previously confirmed application changes remain. If Google revocation fails, the UI explicitly asks the user to revoke CareerUp through their Google account connections. Delete scanner records removes both pasted and Gmail review history without undoing application changes. Existing application board sharing preferences still control who can see the resulting statuses. Persisted mail credentials are removed through disconnect or account deletion, not the 30 day suggestion retention.

## Verification before connecting real mail

Use Node.js 24 or later for the TypeScript rule checks:

```text
npm run verify:email-scanner
npm run verify:email-scanner:database
npm run build
```

The database test requires Docker. It creates a temporary PostgreSQL 16 container with no published ports and no network, applies the migration twice, exercises ownership, grants, MFA, status concurrency, duplicate imports, leases, and disconnect, and removes its own container afterward. Its auth functions are local test stubs, not a replacement for checking deployed Supabase policies. No live Supabase credentials or data are used.

Before launch also test with two confirmed Supabase test accounts: account A must not see account B's email suggestions or credentials. Try cancelled consent, a revoked Google grant, expired test credentials, signing out during connection, an ambiguous company with two roles, duplicate scans, stale confirmations, old messages, and disconnect during a scan. Confirm Google emails stay unread and that the application board changes only after explicit confirmation. A real Google OAuth round trip cannot be validated until OAuth settings and the migration are configured.

## Public deployment considerations

Gmail reading uses a restricted scope. Review Google's OAuth verification and any security assessment requirements before opening the feature to the public. A development testing configuration is not public approval, and Google testing refresh credentials may expire. School managed Google accounts can also block external apps. Supply an accurate privacy policy describing access, retention, deletion, and the limited use of Google user data. Real student research also requires appropriate consent and course or institutional review. Do not promise that broader profile privacy issues elsewhere in the application have been fixed by this migration.

Official references: [Google OAuth web server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [Gmail scopes and verification](https://developers.google.com/workspace/gmail/api/auth/scopes), [message listing](https://developers.google.com/workspace/gmail/api/guides/list-messages), and [Google API user data policy](https://developers.google.com/terms/api-services-user-data-policy).
