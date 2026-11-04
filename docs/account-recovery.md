# CareerUp account recovery

The login page links to /forgot-password. A reset request calls Supabase Auth and directs its default email link to /auth/callback?next=/reset-password. The callback exchanges the PKCE code, writes session cookies, removes the code from the destination URL, and opens the protected password form. Request and open the email in the same browser.

The /auth/confirm endpoint also accepts Supabase token hashes for recovery, email confirmation, and signup. Recovery always leads to /reset-password; other supported confirmation types lead to /dashboard. Caller supplied redirect destinations are not followed. Responses disable caching and referrer forwarding. This endpoint also supports a project administrator's privately issued, single use recovery link. No public route generates administrative recovery tokens.

/reset-password and its server action require a verified Supabase session and an enrolled second factor when applicable. The form checks password length and matching confirmation. Saving updates only the current user's password, signs out sessions, and returns to login. The admin/service role key is not used by the public recovery flow. Never place a user's password, recovery token, or private reset URL in Git, logs, chat, or a public artifact.

## Hosting and email delivery

Set APP_BASE_URL to the exact deployment origin. Supabase's allowed redirect URLs must include that origin's auth callback. The primary site is https://careerup-smoky.vercel.app. Every additional deployment origin needs a matching allowed callback URL so the PKCE exchange returns to the browser that requested recovery. Keep authentication settings separate from Gmail scanner OAuth settings.

The current project uses Supabase's default SMTP service. That service only sends to organization team addresses and has restrictive rate limits. Configure a production SMTP sender for recovery emails to ordinary student accounts. Do not invite students into the Supabase organization just to receive email, disable confirmation, or auto confirm existing users as a workaround. Changing the password form does not configure outbound mail. The request page displays delivery errors without claiming a message was delivered or revealing whether an account exists.

Official documentation:
https://supabase.com/docs/guides/auth/passwords
https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
https://supabase.com/docs/guides/auth/auth-smtp

## Verification

A disposable, confirmed synthetic account was used to verify signed out access denial, rejection of unsupported confirmation types and external redirect targets, recovery session cookies, mismatch validation, successful password update, rejection of the old password, successful login with the new password, single use tokens, and enforcement of enrolled MFA. Tokens were generated through the administrator API only for the synthetic account; no real email was sent and the synthetic account was removed afterward. SMTP delivery must be tested separately with the configured sender and an authorized recipient.
