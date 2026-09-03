# Data Sources

## Job Postings

CareerUp currently parses curated Markdown tables from public GitHub repositories.

### Internship sources

- [Jobright Software Engineering Internships](https://github.com/jobright-ai/2026-Software-Engineer-Internship)
- [Jobright Engineering Internships](https://github.com/jobright-ai/2026-Engineer-Internship)
- [Jobright Data Analysis Internships](https://github.com/jobright-ai/2026-Data-Analysis-Internship)
- [Jobright Product Management Internships](https://github.com/jobright-ai/2026-Product-Management-Internship)
- [Jobright Business Analyst Internships](https://github.com/jobright-ai/2026-Business-Analyst-Internship)
- [SimplifyJobs Summer Internships](https://github.com/SimplifyJobs/Summer2026-Internships)
- [SpeedyApply Software Engineering College Jobs](https://github.com/speedyapply/2026-SWE-College-Jobs)
- [SpeedyApply AI College Jobs](https://github.com/speedyapply/2026-AI-College-Jobs)
- [Zapply Internships](https://github.com/zapplyjobs/Internships-2027)

### New-graduate sources

- Jobright software engineering, engineering, data analysis, product management, and business analyst new-graduate lists
- [SimplifyJobs New-Grad Positions](https://github.com/SimplifyJobs/New-Grad-Positions)
- SpeedyApply software engineering and AI new-graduate tables
- [Zapply New-Grad Jobs](https://github.com/zapplyjobs/New-Grad-Jobs-2027)

## Source Processing

CareerUp downloads the raw README content, parses table rows, normalizes fields, removes duplicate postings, estimates posting recency, and links users to the original application URL. Postings may be cached in Supabase to improve speed.

If cached and live results are unavailable, CareerUp uses clearly labeled sample postings from `lib/postings.ts`.

## User-Provided Data

- Profile information is entered by the user.
- Resume text is extracted from a user-uploaded PDF, DOCX, or text file.
- Application notes, statuses, dates, and messages are entered by users.
- Social and leaderboard information comes from CareerUp account activity.

## School Logos

Supported school names are mapped to school domains in `lib/schools.ts`. The interface requests a small domain icon from Google’s favicon service. These icons are decorative and are not authoritative university branding assets.

## Internally Authored Content

Challenge definitions, badges, ranks, interview prompts, reward checklists, sample profiles, and fallback postings are stored in the repository. They are product content rather than live external data.

## Important Limitations

- GitHub lists can become outdated or change format without notice.
- CareerUp does not independently verify whether every job remains open.
- Fit scores are not employer decisions or predictions of receiving an offer.
- External listings retain their original ownership and terms.
- The current implementation does not use Adzuna or Remotive, even though an older README referenced them.
- Restricted sites such as LinkedIn, Handshake, and Indeed are not scraped.

## Maintenance Checklist

When adding or changing a source:

1. Confirm that its terms permit the intended use.
2. Record the source URL here.
3. Test the parser against missing and changed columns.
4. Preserve the original application link.
5. Deduplicate results.
6. Label fallback/sample data clearly.
7. Update the research report with the collection date and limitations.

