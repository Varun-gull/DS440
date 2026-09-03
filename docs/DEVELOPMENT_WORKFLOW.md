# Development Workflow

## Branch Strategy

Keep `main` deployable. Create one short-lived branch per task:

```text
feature/resume-ai-analysis
feature/user-feedback
fix/calendar-timezone
docs/evaluation-plan
```

## Standard Task Flow

1. Pull the latest `main`.
2. Create a branch.
3. Make one focused change.
4. Test the affected user flow.
5. Run lint and the production build.
6. Update relevant documentation.
7. Push the branch and open a pull request.
8. Ask at least one teammate to review it.
9. Merge after checks pass.

## Commit Messages

Use concise action-oriented messages:

```text
Add structured AI match response
Fix duplicate XP awards
Document job-source limitations
```

Avoid vague messages such as `changes`, `update`, or `stuff`.

## Pull Request Expectations

Each pull request should explain:

- What changed
- Why it changed
- How it was tested
- Any database or environment changes
- Screenshots for visual changes
- Known limitations or follow-up work

## Database Changes

- Add a new dated or clearly named migration under `supabase/`.
- Make migrations safe to rerun where possible.
- Never edit production manually without recording the change.
- Include rollout and rollback notes in the pull request.
- Do not place private data or credentials in SQL files.

## Environment Variables

- Document every variable in `.env.local.example`.
- Store real values only in `.env.local`, Supabase secrets, or Vercel settings.
- Never expose service-role or AI-provider keys with a `NEXT_PUBLIC_` prefix.

## Definition of Done

A task is complete when:

- The requested behavior works.
- Loading, empty, success, and error states are handled.
- Unauthorized access is rejected.
- The change works on mobile and desktop when visual.
- `npm run lint` passes.
- `npm run build` passes.
- Documentation and migrations are included when needed.
- No secrets or private user data appear in the commit.

## Recommended Team Ownership

| Area | Primary responsibility |
| --- | --- |
| Product/research | Scope, research questions, user testing, and report integration |
| Process/methods | Board, meetings, sprint evidence, and methods documentation |
| Data/modeling | Resume/job datasets, baseline, AI model, and experiments |
| Evaluation/infrastructure | Metrics, error analysis, reproducibility, privacy, and deployment |
| Full team | Reviews, testing, presentations, and final report |

