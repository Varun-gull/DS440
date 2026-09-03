# Contributing to CareerUp

## Standard Workflow

1. Pull the latest `main` branch.
2. Create a new branch for one task.
3. Add or change files only in the appropriate project area.
4. Test the change locally.
5. Commit with a clear action-oriented message.
6. Push the branch and open a pull request.
7. Request review from at least one teammate.
8. Merge only after the change has been reviewed and tested.

## Branch Naming

```text
feature/<short-description>
fix/<short-description>
ai/<short-description>
data/<short-description>
docs/<short-description>
```

Examples:

```text
feature/application-tracker
ai/resume-job-matching
data/normalize-job-postings
docs/week-2-progress-report
```

## Commit Messages

Use messages that explain the result:

```text
Add internship search filters
Create keyword-matching baseline
Document job-posting data sources
Fix duplicate application records
```

## Pull Requests

Every pull request should describe:

- What changed
- Why it changed
- How it was tested
- Any new setup steps
- Any privacy, security, data, or AI concerns

## Data Rules

- Never alter files in `data/job-postings/raw/` after collection.
- Place cleaned or transformed versions in `data/job-postings/processed/`.
- Document the source, collection date, license or terms, and processing steps.
- Do not commit private resumes or identifiable research-participant data.
- Large datasets should use approved external storage and a small documented sample in Git.

## Secrets

Real credentials belong in ignored local environment files or the deployment provider’s secret manager. Only placeholder environment templates may be committed.
