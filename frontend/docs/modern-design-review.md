# CareerUp interface refresh

Reviewed November 17, 2026.

## Intended experience

CareerUp should explain its purpose on the first visit and make the next action
obvious after sign in. The shared interface now uses a light canvas, white
surfaces, restrained green accents, clear labels, and compact page headers.

Desktop navigation is a labeled sidebar. Phone navigation keeps the four main
destinations visible and provides every remaining destination in a keyboard
accessible More dialog. Scrolling no longer navigates to another page.

## Scope reviewed in the browser

* Public home, login, signup, password recovery, and the public data overview.
* First sign in privacy setup, retaining the private board default.
* Dashboard and its next step links, progress, recommendations, and challenges.
* Internship and graduate search, result lists, filters, saved states, and peer
  insight access. Longer titles can occupy two lines. Peer links remain
  available when their separate table column is hidden.
* Application history, summary, filtering, populated pipeline, card details,
  status controls, and manual entry.
* AI Coach chat, optional context, offline guide, consent, and live interview
  presentation. Phone context controls collapse above the main tool.
* Free STAR Builder and saved answers.
* Messages with both an empty inbox and a populated synthetic conversation.
  The desktop reply composer remains visible in the conversation workspace.
  Unverified Online indicators were removed.
* Reward shop, redemption details, empty library, shared rewards, and history.
* Challenges, friends and groups, leaderboard, profile, peer profile, and settings.

Main phone layouts were inspected at 390 by 844 CSS pixels. Dashboard and the
scrollable More dialog were additionally checked at 320 by 740. Search and
profile layouts were checked at 1024 by 850, and desktop layouts at 1366 by 900.
The checked phone pages reported matching document and viewport widths.

## Behavior verified using disposable accounts

* Login, logout, and completing privacy setup with sharing left disabled.
* Searching AI Engineer in New York, saving a returned role, and seeing it on
  the application board.
* Creating an application through its form.
* Updating a saved application to Applied and seeing the refreshed column and
  counts. The board now synchronizes its local state with refreshed server data.
* Saving and reloading a complete STAR answer without buying a reward.
* Opening a filter by touch, choosing an option, using arrow keys and Enter,
  and returning focus to its trigger. Outside interaction and Escape close it.
* Opening More, accessing the full navigation, and closing it with Escape,
  which returns focus to More.
* Getting offline guidance and a real Gemini response to a synthetic interview
  question. Resume inclusion remained off.
* Previewing the scanner's sample email as an interview suggestion.
* Reading a synthetic peer conversation and viewing reward details and history.

No messages or friend invitations were sent to actual students. Synthetic
accounts and their records are temporary verification fixtures.

## Build checks and boundaries

Both repository copies passed the Next.js production build. TypeScript and
whitespace checks passed. The existing voice playback suite passed all eight
simulated checks, including queued speech, interruptions, mute, avatar speaking
state, and cleanup.

This refresh does not change database access policies, scoring methods, provider
credentials, Gmail audience restrictions, or shared AI capacity. A physical
microphone session, a fresh delivered signup email, MFA enrollment, and a new
class sized load test were not repeated as part of this interface review.

The public data overview describes implemented controls and current limits. It
does not promise an unavailable self service export or account deletion flow.
Workshop rewards remain Coming soon until a fulfillment partner exists.
