# AI Coach pages

The AI Coach navigation item opens `/coach` for text chat. `/coach/live` is the separate live interview page. The Calendar item has been removed from the main dock. Existing calendar records and scheduling links are preserved.

The previous `/interview/assistant` address redirects to `/coach`. Floating coach links and account settings open the new chat page. Voice rewards open the live interview page directly. Both new routes require login and enrolled two factor verification through the existing route guard. The API also checks the active session and ownership independently.

Live interview setup keeps resume sharing optional and requires voice consent before requesting microphone access. Starting a session hides the setup column and centers the AI avatar. The avatar reflects connecting, queueing, listening, speaking and muted states. Speaking starts when output audio is queued and ends when the final queued audio node finishes, rather than when a caption arrives or generation completes. The visualizer is an animated state indicator, not a microphone level measurement.

Mute and end controls remain beside the avatar. Leaving the page, switching browser tabs or ending the interview stops the microphone. Waiting in the shared queue keeps the microphone off. Captions remain in page memory and are cleared on a new session. Reduced motion preferences disable avatar animations.

`npm run verify:voice-playback` checks audio scheduling, activity callbacks, interruptions, mute and cleanup using simulated browser audio objects. `npm run verify:voice-completion` checks a complete reply through the actual deployed API with a disposable account. Neither script claims to exercise a physical microphone.
