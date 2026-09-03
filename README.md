# CareerUp AI — DS 440 Capstone

This repository is the shared workspace for the CareerUp AI capstone project.

CareerUp will be an interactive job board and career-management platform that helps college students discover opportunities, organize applications, and stay engaged throughout the job-search process. The platform may use progress-based features such as streaks, challenges, rankings, and optional leaderboards, but it is not intended to be a game.

The repository currently contains only the organized project structure. Application code, datasets, models, experiments, and reports should be added to the appropriate folders as the team develops them.

## Repository Structure

```text
DS440/
├── frontend/                    Website pages, components, and styling
├── backend/                     Server APIs and application logic
├── ai/                          AI models, prompts, evaluation, and baselines
├── data/
│   └── job-postings/
│       ├── raw/                 Original collected job-posting data
│       └── processed/           Cleaned data ready for analysis
├── database/
│   └── migrations/              Database schema and migration files
├── tests/                       Automated and evaluation tests
├── scripts/                     Data, setup, and maintenance scripts
├── assets/                      Images, diagrams, and approved design assets
├── docs/                        Project, research, and technical documentation
├── project-management/
│   ├── meeting-notes/           Team meeting records
│   ├── sprint-reports/          Sprint plans, reviews, and retrospectives
│   └── progress-reports/        Course progress-report drafts and evidence
├── .github/                     GitHub collaboration templates
└── CONTRIBUTING.md              Team development workflow
```

## Folder Responsibilities

| Folder | What belongs there |
| --- | --- |
| `frontend/` | User-facing website code and interface tests |
| `backend/` | APIs, authentication, business logic, and external integrations |
| `ai/` | Keyword baseline, AI matching, prompts, experiments, and evaluation code |
| `data/job-postings/raw/` | Unmodified source data with dates and provenance |
| `data/job-postings/processed/` | Cleaned, normalized, and documented datasets |
| `database/` | Database design, migrations, policies, and seed data |
| `tests/` | Cross-project unit, integration, security, and evaluation tests |
| `scripts/` | Reusable commands for setup, data processing, and maintenance |
| `assets/` | Images, screenshots, figures, and diagrams used by the project |
| `docs/` | Requirements, architecture, methodology, sources, and research notes |
| `project-management/` | Sprint evidence, meeting notes, and course reports |

## Team Rules

1. Do not commit directly to `main` for regular development.
2. Create a focused branch such as `feature/job-search`, `ai/match-model`, or `docs/research-plan`.
3. Keep raw data unchanged; save transformations under `processed/`.
4. Record the source and collection date for every dataset.
5. Never commit passwords, API keys, private resumes, or identifiable participant data.
6. Run the relevant tests before opening a pull request.
7. Update documentation whenever behavior, data sources, or setup requirements change.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete team workflow.

## Previous Version

The earlier CareerUp application remains recoverable in Git history at commit `48ba709`. This clean structure is the starting point for the DS 440 team implementation.
