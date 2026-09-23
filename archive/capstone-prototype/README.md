# CareerUp Frontend

This folder contains the first DS 440 CareerUp frontend prototype. It intentionally focuses on the current capstone stage instead of recreating every feature from the original application.

## Included now

1. Responsive dashboard
2. Searchable job board using sample postings
3. Basic application tracker
4. Simple progress and streak concepts
5. Project status page explaining the current research scope
6. One continuous vertical experience with floating section navigation

## Intentionally deferred

1. Supabase authentication and database access
2. Live job source collection
3. Resume uploads and private student data
4. Advanced AI matching
5. Friends, messaging, groups, rewards, and leaderboards

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in a browser.

## Current data behavior

The prototype uses temporary sample postings from `data/jobs.ts`. Application changes are stored only in React state and reset when the page reloads. This makes the implementation safe to demonstrate before Supabase is connected.

## Next milestone

Connect the frontend to the planned Supabase tables and replace the sample postings with the first processed job source.
