# CareerUp integration verification

Verified October 28, 2026. Scope: application email review, optional career chat and live voice, and compatibility with the existing Supabase application.

## Completed checks

* Production build: passed with Next.js 15.5.28 and TypeScript validation.
* Dependency audit: zero reported vulnerabilities in the complete installed dependency tree.
* Email scanner rules and encrypted credentials: 31 synthetic checks passed.
* Assistant validation, privacy instructions, offline behavior, and audio conversion: 33 synthetic checks passed.
* Isolated database migration and authorization: 36 checks passed in a temporary PostgreSQL 16 container. Includes duplicate imports, ownership, concurrent confirmation, scan leases, MFA, and assistant quotas.
* Authenticated local integration: 14 checks passed against the live Supabase project with two disposable synthetic accounts. Includes cross account isolation, same origin rejection, explicit application status confirmation, duplicate prevention, consent validation, and first factor access blocked after MFA enrollment.
* Browser review: a disposable signed in account opened the assistant, selected pasted AI Engineer job context, included its synthetic resume, and received a labelled offline evidence explanation. The scanner's sample email produced an Interviewing suggestion without automatically changing an application.
* Fit scorer regression examples: vague model evidence scored 55, contextual forecasting model evidence scored 66, and unrelated AI or broad words alone scored 0. These are synthetic examples, not measured real world accuracy.

The live database received only the additive `email-scanner.sql` and `career-assistant.sql` migrations. The existing base schema was not rerun. Test accounts are deleted by the integration scripts. No real mailbox, student resume, or private application was used for verification.

## External activation remains pending

The project owner chose to deploy with Gemini and Google OAuth credentials absent. Real Gemini replies, provider audio, physical microphone behavior, and a Gmail OAuth round trip are therefore not verified. Their interface controls remain unavailable until private configuration is present. Offline guidance is explicitly labelled and is not presented as generative AI.

To activate later, follow `career-assistant-setup.md` and `email-scanner-setup.md`, add credentials privately in the hosting environment, redeploy, and run the provider and browser tests described there. Students must approve their own mailbox connection. A successful build does not validate Google provider access.

## Deployment smoke test

The authenticated integration script can test a production URL using `CAREERUP_TEST_BASE_URL` and explicit `CAREERUP_ALLOW_DEPLOYED_TESTS=true`. It creates and cleans up its own test accounts and performs no real email operations. The release commit and production deployment status are recorded in Git and Vercel respectively.
