"use client";

import {
  ArrowRight,
  BarChart3,
  Bookmark,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  Database,
  Flame,
  Home,
  LayoutDashboard,
  Search,
  Sparkles,
  Target,
  Trophy,
  X
} from "lucide-react";
import { useMemo, useState } from "react";
import { sampleJobs, type Job } from "@/data/jobs";

type View = "dashboard" | "jobs" | "applications" | "project";
type ApplicationStage = "Saved" | "Applied" | "Interview";
type Application = {
  jobId: string;
  stage: ApplicationStage;
};

const navItems: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "jobs", label: "Job board", icon: Search },
  { id: "applications", label: "Applications", icon: ClipboardList },
  { id: "project", label: "Project status", icon: BarChart3 }
];

const stages: ApplicationStage[] = ["Saved", "Applied", "Interview"];

const initialApplications: Application[] = [
  { jobId: "job-2", stage: "Saved" },
  { jobId: "job-3", stage: "Applied" }
];

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function MatchBadge({ score }: { score: number }) {
  const tone = score >= 80 ? "matchHigh" : score >= 70 ? "matchMedium" : "matchLow";

  return (
    <div className={classNames("matchBadge", tone)} title="Prototype keyword score">
      <strong>{score}%</strong>
      <span>keyword fit</span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone
}: {
  icon: typeof Home;
  label: string;
  value: string | number;
  detail: string;
  tone: "blue" | "green" | "orange" | "slate";
}) {
  return (
    <article className="statCard">
      <div className={classNames("statIcon", tone)}>
        <Icon size={20} aria-hidden="true" />
      </div>
      <div>
        <p className="statLabel">{label}</p>
        <p className="statValue">{value}</p>
        <p className="statDetail">{detail}</p>
      </div>
    </article>
  );
}

function JobCard({
  job,
  application,
  onSave,
  onApply
}: {
  job: Job;
  application?: Application;
  onSave: (jobId: string) => void;
  onApply: (jobId: string) => void;
}) {
  return (
    <article className="jobCard">
      <div className="jobCardTop">
        <div className="companyMark" aria-hidden="true">
          {job.company
            .split(" ")
            .map((word) => word[0])
            .join("")
            .slice(0, 2)}
        </div>
        <div className="jobHeading">
          <p className="jobMetaTop">{job.type} · {job.posted}</p>
          <h3>{job.title}</h3>
          <p>{job.company} · {job.location} · {job.workMode}</p>
        </div>
        <MatchBadge score={job.match} />
      </div>
      <p className="jobSummary">{job.summary}</p>
      <div className="skillList" aria-label="Relevant skills">
        {job.skills.map((skill) => (
          <span key={skill}>{skill}</span>
        ))}
      </div>
      <div className="jobFooter">
        <p>Source: {job.source}</p>
        <div className="jobActions">
          <button
            className={classNames("secondaryAction", application?.stage === "Saved" && "selectedAction")}
            onClick={() => onSave(job.id)}
            type="button"
          >
            <Bookmark size={16} aria-hidden="true" />
            {application?.stage === "Saved" ? "Saved" : "Save"}
          </button>
          <button className="primaryAction" onClick={() => onApply(job.id)} type="button">
            {application && application.stage !== "Saved" ? "Applied" : "Track application"}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

function Dashboard({
  applications,
  onNavigate,
  onSave,
  onApply
}: {
  applications: Application[];
  onNavigate: (view: View) => void;
  onSave: (jobId: string) => void;
  onApply: (jobId: string) => void;
}) {
  const sentCount = applications.filter((application) => application.stage !== "Saved").length;
  const savedCount = applications.filter((application) => application.stage === "Saved").length;
  const weeklyGoal = 5;
  const progress = Math.min(100, Math.round((sentCount / weeklyGoal) * 100));

  return (
    <div className="viewStack">
      <section className="heroPanel">
        <div>
          <p className="eyebrow">Frontend milestone</p>
          <h1>Build a better job search routine</h1>
          <p className="heroCopy">
            CareerUp keeps opportunities and applications organized while testing whether simple progress features can improve student motivation.
          </p>
          <div className="heroActions">
            <button className="primaryAction largeAction" onClick={() => onNavigate("jobs")} type="button">
              Browse opportunities
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button className="secondaryAction largeAction" onClick={() => onNavigate("project")} type="button">
              View project scope
            </button>
          </div>
        </div>
        <div className="goalPanel">
          <div className="goalHeader">
            <div>
              <p className="eyebrow">Weekly application goal</p>
              <p className="goalValue">{sentCount} of {weeklyGoal}</p>
            </div>
            <Target size={32} aria-hidden="true" />
          </div>
          <div className="progressTrack" aria-label={`${progress} percent of weekly goal completed`}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="goalHint">Track meaningful applications and build consistency one step at a time.</p>
        </div>
      </section>

      <section className="statGrid" aria-label="Career progress summary">
        <StatCard icon={Bookmark} label="Saved jobs" value={savedCount} detail="Ready to review" tone="blue" />
        <StatCard icon={BriefcaseBusiness} label="Applications sent" value={sentCount} detail="This prototype session" tone="green" />
        <StatCard icon={Flame} label="Current streak" value="2 days" detail="Motivation preview" tone="orange" />
        <StatCard icon={Trophy} label="Weekly progress" value={`${progress}%`} detail="Based on application goal" tone="slate" />
      </section>

      <section className="contentGrid">
        <div className="panel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Keyword baseline</p>
              <h2>Recommended opportunities</h2>
              <p>Sample postings ranked with a transparent prototype score.</p>
            </div>
            <button className="textAction" onClick={() => onNavigate("jobs")} type="button">
              View all <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="compactJobs">
            {sampleJobs.slice(0, 3).map((job) => {
              const application = applications.find((item) => item.jobId === job.id);
              return (
                <JobCard
                  key={job.id}
                  job={job}
                  application={application}
                  onSave={onSave}
                  onApply={onApply}
                />
              );
            })}
          </div>
        </div>

        <aside className="panel scopePanel">
          <div className="sectionHeader simpleHeader">
            <div>
              <p className="eyebrow">Current capstone scope</p>
              <h2>Frontend first</h2>
            </div>
          </div>
          <div className="scopeList">
            <div>
              <span className="scopeIcon ready"><Check size={16} /></span>
              <div><strong>Included now</strong><p>Dashboard, job board, application tracker, and research status.</p></div>
            </div>
            <div>
              <span className="scopeIcon next"><Database size={16} /></span>
              <div><strong>Next milestone</strong><p>Connect Supabase and replace sample postings with imported data.</p></div>
            </div>
            <div>
              <span className="scopeIcon later"><Sparkles size={16} /></span>
              <div><strong>Later research work</strong><p>Semantic AI matching, user testing, and expanded motivation features.</p></div>
            </div>
          </div>
          <div className="prototypeNote">
            <strong>Prototype note</strong>
            <p>All jobs and progress shown here use temporary sample data. No accounts or private resumes are connected.</p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function JobBoard({
  applications,
  onSave,
  onApply
}: {
  applications: Application[];
  onSave: (jobId: string) => void;
  onApply: (jobId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All opportunities");

  const filteredJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return sampleJobs.filter((job) => {
      const matchesQuery = !normalized || `${job.title} ${job.company} ${job.location} ${job.skills.join(" ")}`.toLowerCase().includes(normalized);
      const matchesType = type === "All opportunities" || job.type === type;
      return matchesQuery && matchesType;
    });
  }, [query, type]);

  return (
    <div className="viewStack">
      <section className="pageIntro">
        <div>
          <p className="eyebrow">Sample posting data</p>
          <h1>Find your next opportunity</h1>
          <p>Explore the first CareerUp job board interface before live data is connected.</p>
        </div>
        <div className="stageBadge"><span /> Frontend prototype</div>
      </section>

      <section className="filterBar" aria-label="Job filters">
        <label className="searchField">
          <Search size={18} aria-hidden="true" />
          <span className="srOnly">Search jobs</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search roles, companies, or skills" />
        </label>
        <label className="selectField">
          <span className="srOnly">Opportunity type</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option>All opportunities</option>
            <option>Internship</option>
            <option>Entry level</option>
          </select>
        </label>
      </section>

      <div className="resultsHeader">
        <p><strong>{filteredJobs.length}</strong> sample opportunities</p>
        <p>Sorted by prototype keyword fit</p>
      </div>

      <section className="jobList">
        {filteredJobs.length ? filteredJobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            application={applications.find((item) => item.jobId === job.id)}
            onSave={onSave}
            onApply={onApply}
          />
        )) : (
          <div className="emptyState">
            <Search size={28} aria-hidden="true" />
            <h2>No sample jobs match that search</h2>
            <p>Try a broader title, company, location, or skill.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Applications({
  applications,
  onMove,
  onRemove
}: {
  applications: Application[];
  onMove: (jobId: string, stage: ApplicationStage) => void;
  onRemove: (jobId: string) => void;
}) {
  return (
    <div className="viewStack">
      <section className="pageIntro">
        <div>
          <p className="eyebrow">Simple application tracker</p>
          <h1>Keep every opportunity organized</h1>
          <p>Move applications through a basic workflow while the database connection is still planned.</p>
        </div>
        <div className="stageBadge"><span /> Local prototype state</div>
      </section>

      <section className="pipelineBoard">
        {stages.map((stage) => {
          const stageApplications = applications.filter((application) => application.stage === stage);
          return (
            <div className="pipelineColumn" key={stage}>
              <div className="pipelineHeader">
                <div>
                  <span className={classNames("stageDot", stage.toLowerCase())} />
                  <h2>{stage}</h2>
                </div>
                <span>{stageApplications.length}</span>
              </div>
              <div className="pipelineCards">
                {stageApplications.map((application) => {
                  const job = sampleJobs.find((item) => item.id === application.jobId);
                  if (!job) return null;
                  const currentIndex = stages.indexOf(stage);
                  const nextStage = stages[currentIndex + 1];
                  return (
                    <article className="applicationCard" key={job.id}>
                      <p className="applicationType">{job.type}</p>
                      <h3>{job.title}</h3>
                      <p>{job.company}</p>
                      <p className="applicationLocation">{job.location}</p>
                      <div className="applicationActions">
                        {nextStage ? (
                          <button type="button" onClick={() => onMove(job.id, nextStage)}>
                            Move to {nextStage.toLowerCase()} <ChevronRight size={15} />
                          </button>
                        ) : <span className="finalStage"><Check size={15} /> Interview stage</span>}
                        <button className="removeButton" type="button" onClick={() => onRemove(job.id)} aria-label={`Remove ${job.title}`}>
                          <X size={15} />
                        </button>
                      </div>
                    </article>
                  );
                })}
                {!stageApplications.length && (
                  <div className="columnEmpty">No applications in this stage</div>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function ProjectStatus() {
  const milestones = [
    { title: "Frontend prototype", status: "Current", copy: "Build the dashboard, job board, and application workflow with sample data." },
    { title: "Supabase integration", status: "Next", copy: "Create the planned tables and connect real user and posting records." },
    { title: "Keyword baseline", status: "Next", copy: "Document a reproducible baseline for resume and job description matching." },
    { title: "Advanced AI evaluation", status: "Later", copy: "Compare semantic matching with the baseline and collect student feedback." }
  ];

  return (
    <div className="viewStack">
      <section className="pageIntro">
        <div>
          <p className="eyebrow">Capstone alignment</p>
          <h1>A focused and testable project scope</h1>
          <p>This page makes the current implementation stage clear for teammates and course reviews.</p>
        </div>
      </section>

      <section className="researchQuestion">
        <div className="researchIcon"><Sparkles size={24} aria-hidden="true" /></div>
        <div>
          <p className="eyebrow">Research question</p>
          <h2>To what extent do rewards, progress tracking, challenges, and friendly competition influence college students’ motivation and consistency when searching and applying for opportunities?</h2>
        </div>
      </section>

      <section className="milestoneGrid">
        {milestones.map((milestone, index) => (
          <article className="milestoneCard" key={milestone.title}>
            <div className="milestoneTop">
              <span className="milestoneNumber">{index + 1}</span>
              <span className={classNames("milestoneStatus", milestone.status.toLowerCase())}>{milestone.status}</span>
            </div>
            <h2>{milestone.title}</h2>
            <p>{milestone.copy}</p>
          </article>
        ))}
      </section>

      <section className="scopeComparison">
        <div>
          <p className="eyebrow">Included in this prototype</p>
          <ul>
            <li><Check size={17} /> Responsive CareerUp interface</li>
            <li><Check size={17} /> Searchable sample job board</li>
            <li><Check size={17} /> Basic application stages</li>
            <li><Check size={17} /> Visible progress and streak concept</li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mutedEyebrow">Intentionally deferred</p>
          <ul className="deferredList">
            <li><X size={17} /> User authentication</li>
            <li><X size={17} /> Live job source collection</li>
            <li><X size={17} /> Resume uploads and private data</li>
            <li><X size={17} /> Advanced AI recommendations</li>
            <li><X size={17} /> Friends, messaging, and leaderboards</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

export function CareerUpPrototype() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [applications, setApplications] = useState<Application[]>(initialApplications);

  function navigate(view: View) {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveJob(jobId: string) {
    setApplications((current) => {
      const existing = current.find((item) => item.jobId === jobId);
      if (existing?.stage === "Saved") return current.filter((item) => item.jobId !== jobId);
      if (existing) return current;
      return [...current, { jobId, stage: "Saved" }];
    });
  }

  function applyToJob(jobId: string) {
    setApplications((current) => {
      const existing = current.find((item) => item.jobId === jobId);
      if (existing) return current.map((item) => item.jobId === jobId ? { ...item, stage: "Applied" } : item);
      return [...current, { jobId, stage: "Applied" }];
    });
  }

  function moveApplication(jobId: string, stage: ApplicationStage) {
    setApplications((current) => current.map((item) => item.jobId === jobId ? { ...item, stage } : item));
  }

  function removeApplication(jobId: string) {
    setApplications((current) => current.filter((item) => item.jobId !== jobId));
  }

  return (
    <div className="appFrame">
      <header className="topBar">
        <button className="brandLockup" type="button" onClick={() => navigate("dashboard")}>
          <div className="brandMark"><span /><span /></div>
          <div><strong>CareerUp</strong><small>Capstone prototype</small></div>
        </button>

        <nav className="sideNav" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={classNames(activeView === item.id && "activeNav")}
                onClick={() => navigate(item.id)}
              >
                <Icon size={19} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="profilePreview">
          <div><strong>Student preview</strong><span>No account connected</span></div>
          <CircleUserRound size={34} aria-hidden="true" />
        </div>
      </header>

      <div className="mainArea">
        <section className="contextBar">
          <div>
            <p>DS 440 · Group 10</p>
            <strong>{navItems.find((item) => item.id === activeView)?.label}</strong>
          </div>
          <div className="focusLabel">
            <Sparkles size={17} aria-hidden="true" />
            <span><strong>Current focus</strong> Frontend and data design</span>
          </div>
        </section>

        <main className="mainContent">
          {activeView === "dashboard" && <Dashboard applications={applications} onNavigate={navigate} onSave={saveJob} onApply={applyToJob} />}
          {activeView === "jobs" && <JobBoard applications={applications} onSave={saveJob} onApply={applyToJob} />}
          {activeView === "applications" && <Applications applications={applications} onMove={moveApplication} onRemove={removeApplication} />}
          {activeView === "project" && <ProjectStatus />}
        </main>

        <footer className="siteFooter">
          <span>CareerUp · DS 440 capstone prototype</span>
          <span>Sample data only</span>
        </footer>
      </div>
    </div>
  );
}
