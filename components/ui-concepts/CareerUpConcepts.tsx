import {
  ArrowUpRight,
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Flame,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LockKeyhole,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Zap
} from "lucide-react";
import Link from "next/link";

const navItems = ["Dashboard", "Applications", "Postings", "Interview Prep", "Rewards", "Leaderboard"];

const roles = [
  { company: "Ramp", title: "Software Engineer Intern", fit: "94", mode: "Hybrid", city: "New York", age: "2h" },
  { company: "NVIDIA", title: "AI Research Intern", fit: "91", mode: "On-site", city: "Santa Clara", age: "4h" },
  { company: "Stripe", title: "Data Science Intern", fit: "88", mode: "Remote", city: "US", age: "6h" },
  { company: "Duolingo", title: "Product Analyst Intern", fit: "84", mode: "Hybrid", city: "Pittsburgh", age: "1d" }
];

const pipeline = [
  { label: "Saved", count: 12, color: "bg-slate-200 text-slate-700" },
  { label: "Applied", count: 8, color: "bg-blue-100 text-blue-700" },
  { label: "Interviewing", count: 3, color: "bg-sky-100 text-sky-700" },
  { label: "Offer", count: 1, color: "bg-amber-100 text-amber-700" }
];

const events = [
  { time: "10:30", title: "Meta screen", tone: "bg-cyan-400" },
  { time: "1:00", title: "Resume review", tone: "bg-sky-400" },
  { time: "3:30", title: "Apply sprint", tone: "bg-amber-400" }
];

const challenges = [
  { title: "Daily Apply Sprint", reward: "+40 XP", progress: "1/1", description: "Submit one high-quality application today.", color: "bg-sky-500" },
  { title: "Resume Ready", reward: "+40 XP", progress: "1/1", description: "Keep a readable resume attached for matching.", color: "bg-sky-500" },
  { title: "Interview Momentum", reward: "+55 XP", progress: "2/3", description: "Move three roles into interviewing this month.", color: "bg-violet-500" },
  { title: "Network Signal", reward: "+25 XP", progress: "3/5", description: "Message peers tracking similar roles.", color: "bg-amber-500" }
];

function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${className}`}>
      <BriefcaseBusiness size={22} />
    </span>
  );
}

function ConceptShell({
  children,
  title,
  subtitle,
  background,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  background: string;
}) {
  return (
    <main className={`min-h-screen ${background}`}>
      <div className="mx-auto w-full max-w-[118rem] px-5 py-6 sm:px-8 lg:px-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/ui" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/70 px-4 py-2 text-sm font-bold text-slate-800 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5">
            <ChevronRight className="rotate-180" size={16} />
            UI Concepts
          </Link>
          <div className="text-right">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{subtitle}</p>
            <h1 className="text-xl font-black text-slate-950">{title}</h1>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

function MiniMetric({ label, value, icon: Icon, dark = false }: { label: string; value: string; icon: typeof Zap; dark?: boolean }) {
  return (
    <div className={`rounded-3xl border p-5 ${dark ? "border-white/10 bg-white/5 text-white" : "border-slate-200 bg-white text-slate-950"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm font-bold ${dark ? "text-slate-300" : "text-slate-500"}`}>{label}</p>
        <Icon size={20} className={dark ? "text-cyan-300" : "text-blue-600"} />
      </div>
      <p className="mt-3 text-3xl font-black">{value}</p>
    </div>
  );
}

export function ConceptIndex() {
  const concepts = [
    { href: "/ui/v2", name: "V2 Aurora Command", copy: "Light V1-inspired command center with challenges, streaks, and pipeline focus.", color: "from-sky-50 to-slate-200" },
    { href: "/ui/v3", name: "V3 Campus Ledger", copy: "Bright editorial dashboard with structured tables and academic signals.", color: "from-white to-amber-100" },
    { href: "/ui/v4", name: "V4 Signal Console", copy: "Dense pro console for fast scanning, rankings, and pipeline control.", color: "from-slate-950 to-stone-900" },
    { href: "/ui/v5", name: "V5 Lift OS", copy: "Soft modern workspace with friendly cards and clear next actions.", color: "from-sky-50 to-sky-50" }
  ];

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f8fafc_0%,#e8eef8_48%,#f3f4f6_100%)] px-5 py-10">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-600">CareerUp UI Lab</p>
              <h1 className="mt-3 text-4xl font-black text-slate-950">Version 1 is saved. Pick a new direction.</h1>
            </div>
            <LogoMark className="bg-slate-950 text-white shadow-glow" />
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {concepts.map((concept) => (
              <Link key={concept.href} href={concept.href} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-strong">
                <div className={`h-28 bg-gradient-to-br ${concept.color}`} />
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-black text-slate-950">{concept.name}</h2>
                    <ArrowUpRight size={18} className="text-slate-400 transition group-hover:text-sky-600" />
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{concept.copy}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export function AuroraCommandConcept() {
  return (
    <ConceptShell title="V2 Aurora Command" subtitle="Light command center with V1 navigation" background="bg-[linear-gradient(135deg,#f8fafc_0%,#eef6ff_45%,#e8f0f7_100%)] text-slate-950">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 shadow-soft backdrop-blur-xl">
        <header className="border-b border-slate-200 bg-navy/95 px-5 py-3 text-white shadow-lg shadow-black/20">
          <div className="grid grid-cols-[auto_auto] items-center justify-between gap-3 lg:grid-cols-[1fr_auto_1fr]">
            <div className="flex items-center gap-3">
              <LogoMark className="bg-gradient-to-br from-slate-800 via-slate-700 to-sky text-white shadow-glow" />
              <span className="text-lg font-bold">CareerUp</span>
            </div>
            <nav className="nav-scroll col-span-2 row-start-2 flex min-w-0 items-center gap-2.5 overflow-x-auto pb-1 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:justify-center lg:overflow-visible lg:pb-0">
              {navItems.map((item, index) => (
                <span key={item} className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${index === 0 ? "bg-sky text-white shadow-glow" : "text-slate-300 hover:bg-white/10 hover:text-sky"}`}>
                  {item}
                </span>
              ))}
            </nav>
            <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 lg:col-start-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm">
                <MessageSquare size={18} />
              </span>
              <span className="relative hidden h-11 w-11 flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-sm sm:flex">
                <span className="absolute left-0 right-0 top-0 flex h-[16px] items-center justify-center bg-sky text-[8px] font-bold text-white">JUL</span>
                <span className="relative mt-3 text-[15px] font-bold leading-none">05</span>
              </span>
              <span className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-sm">Varun</span>
            </div>
          </div>
        </header>

        <div className="grid gap-6 p-6 xl:grid-cols-[280px_1fr_380px]">
          <aside className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="rounded-3xl bg-[linear-gradient(135deg,#0f172a,#0ea5e9)] p-5 text-white shadow-glow">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Mission level</p>
              <p className="mt-3 text-5xl font-black">145 XP</p>
              <div className="mt-4 h-2 rounded-full bg-white/20">
                <div className="h-2 w-7/12 rounded-full bg-white" />
              </div>
              <p className="mt-3 text-sm font-bold text-cyan-50">105 XP to Manager</p>
            </div>
            <div className="mt-4 grid gap-3">
              {pipeline.map((stage) => (
                <div key={stage.label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="font-bold text-slate-600">{stage.label}</span>
                  <span className="text-xl font-black text-slate-950">{stage.count}</span>
                </div>
              ))}
            </div>
          </aside>

          <section className="space-y-5">
            <div className="rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#eff6ff)] p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-600">Command center</p>
                  <h2 className="mt-3 max-w-3xl text-5xl font-black leading-tight text-slate-950">Your climb dashboard is ready.</h2>
                  <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-slate-600">
                    Keep the V2 momentum layout, but focus the center on streaks, challenges, and application progress.
                  </p>
                </div>
                <button className="rounded-2xl bg-sky px-5 py-3 font-black text-white shadow-glow">Add role</button>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-600">XP quests</p>
                  <h3 className="mt-1 text-3xl font-black text-slate-950">Challenges</h3>
                </div>
                <span className="rounded-full bg-sky/10 px-4 py-2 text-sm font-black text-sky-700">3 active today</span>
              </div>
              <div className="mt-5 grid gap-3">
                {challenges.map((challenge) => (
                  <div key={challenge.title} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white ${challenge.color}`}>
                      <CheckCircle2 size={21} />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-black text-slate-950">{challenge.title}</h4>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500">{challenge.progress}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-600">{challenge.description}</p>
                    </div>
                    <span className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white">{challenge.reward}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <MiniMetric label="Streak" value="6 days" icon={Flame} />
            <MiniMetric label="Interviews" value="3" icon={MessageSquare} />
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-black text-sky-600">Today</p>
              <div className="mt-4 grid gap-3">
                {events.map((event) => (
                  <div key={event.time} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                    <span className={`h-3 w-3 rounded-full ${event.tone}`} />
                    <span className="font-black text-slate-950">{event.time}</span>
                    <span className="text-sm font-bold text-slate-600">{event.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </ConceptShell>
  );
}

export function CampusLedgerConcept() {
  return (
    <ConceptShell title="V3 Campus Ledger" subtitle="Bright academic workspace" background="bg-[#f7f4ed] text-slate-950">
      <section className="rounded-[2rem] border border-stone-300 bg-[#fffdf8] shadow-soft">
        <header className="grid gap-5 border-b border-stone-200 p-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <div className="flex items-center gap-3">
            <LogoMark className="bg-[#143d59] text-white" />
            <div>
              <p className="text-2xl font-black text-[#143d59]">CareerUp</p>
              <p className="font-bold text-stone-500">Internship portfolio ledger</p>
            </div>
          </div>
          <nav className="flex flex-wrap justify-center gap-2">
            {navItems.map((item, index) => (
              <span key={item} className={`rounded-xl px-4 py-2 text-sm font-black ${index === 1 ? "bg-[#143d59] text-white" : "bg-stone-100 text-stone-700"}`}>
                {item}
              </span>
            ))}
          </nav>
          <div className="flex items-center justify-end gap-2">
            <button className="rounded-xl border border-stone-200 bg-white p-3"><Bell size={18} /></button>
            <button className="rounded-xl bg-[#f4b942] px-4 py-3 font-black text-[#143d59]">Varun</button>
          </div>
        </header>

        <div className="grid gap-6 p-6 xl:grid-cols-[1fr_420px]">
          <section>
            <div className="grid gap-4 md:grid-cols-4">
              <MiniMetric label="Total XP" value="145" icon={Trophy} />
              <MiniMetric label="Applied" value="8" icon={CheckCircle2} />
              <MiniMetric label="Saved" value="12" icon={BriefcaseBusiness} />
              <MiniMetric label="Rank" value="Bronze" icon={GraduationCap} />
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl border border-stone-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c15c2e]">Role table</p>
                  <h2 className="text-2xl font-black text-[#143d59]">Best matches this week</h2>
                </div>
                <button className="rounded-xl bg-[#143d59] px-4 py-2 font-black text-white">Open postings</button>
              </div>
              <div className="divide-y divide-stone-100">
                {roles.map((role, index) => (
                  <div key={role.company} className="grid gap-3 px-5 py-4 md:grid-cols-[48px_1fr_120px_120px_100px] md:items-center">
                    <span className="text-lg font-black text-stone-400">{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <p className="font-black text-[#143d59]">{role.title}</p>
                      <p className="text-sm font-bold text-stone-500">{role.company}</p>
                    </div>
                    <span className="font-bold text-stone-600">{role.city}</span>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-center text-sm font-black text-stone-700">{role.mode}</span>
                    <span className="text-right font-black text-sky-700">{role.fit}%</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-3xl bg-[#143d59] p-6 text-white">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b942]">Application board</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {pipeline.map((stage) => (
                  <div key={stage.label} className="rounded-2xl bg-white/10 p-4">
                    <p className="text-sm font-bold text-stone-200">{stage.label}</p>
                    <p className="mt-2 text-3xl font-black">{stage.count}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-stone-200 bg-white p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c15c2e]">Interview prep</p>
              <h3 className="mt-2 text-2xl font-black text-[#143d59]">STAR story bank</h3>
              <div className="mt-4 space-y-3">
                {["Tell me about ambiguity", "Technical conflict", "Leadership example"].map((story) => (
                  <div key={story} className="rounded-2xl bg-stone-100 px-4 py-3 font-bold text-stone-700">{story}</div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </ConceptShell>
  );
}

export function SignalConsoleConcept() {
  return (
    <ConceptShell title="V4 Signal Console" subtitle="High-density operator UI" background="bg-[#11100e] text-stone-100">
      <section className="grid overflow-hidden rounded-[2rem] border border-stone-700 bg-[#181715] shadow-strong lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-stone-700 bg-[#0f0f0d] p-5">
          <div className="flex items-center gap-3">
            <LogoMark className="bg-[#f97316] text-black" />
            <div>
              <p className="text-xl font-black">CareerUp</p>
              <p className="text-xs font-bold text-stone-400">Signal Console</p>
            </div>
          </div>
          <nav className="mt-8 grid gap-2">
            {navItems.map((item, index) => (
              <span key={item} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black ${index === 2 ? "bg-[#f97316] text-black" : "text-stone-300 hover:bg-stone-800"}`}>
                {index === 0 ? <LayoutDashboard size={18} /> : index === 1 ? <ListChecks size={18} /> : index === 2 ? <Search size={18} /> : index === 3 ? <BookOpenCheck size={18} /> : index === 4 ? <Trophy size={18} /> : <Users size={18} />}
                {item}
              </span>
            ))}
          </nav>
          <div className="mt-8 rounded-3xl border border-stone-700 bg-stone-900 p-4">
            <p className="text-sm font-black text-stone-400">Resume signal</p>
            <p className="mt-2 text-2xl font-black text-white">Active</p>
            <p className="mt-2 text-sm font-semibold text-stone-400">Matching roles against 18 extracted skills.</p>
          </div>
        </aside>

        <div className="p-5">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-stone-700 bg-[#22201d] p-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f97316]">Live index</p>
              <h1 className="text-3xl font-black text-white">Internship search control room</h1>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button className="rounded-2xl border border-stone-700 p-3"><MessageSquare size={18} /></button>
              <button className="rounded-2xl border border-stone-700 p-3"><CalendarDays size={18} /></button>
              <button className="rounded-2xl bg-stone-100 px-4 py-3 font-black text-black">VG</button>
            </div>
          </header>

          <section className="mt-5 grid gap-4 xl:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <MiniMetric label="Fresh roles" value="1,284" icon={Zap} dark />
                <MiniMetric label="Fit threshold" value="80%" icon={Target} dark />
                <MiniMetric label="Messages" value="14" icon={MessageSquare} dark />
              </div>
              <div className="overflow-hidden rounded-3xl border border-stone-700 bg-[#22201d]">
                {roles.map((role) => (
                  <div key={role.company} className="grid gap-3 border-b border-stone-700 px-5 py-4 last:border-b-0 md:grid-cols-[1fr_100px_110px_90px] md:items-center">
                    <div>
                      <p className="text-sm font-black text-[#f97316]">{role.company}</p>
                      <h3 className="text-xl font-black text-white">{role.title}</h3>
                      <p className="text-sm font-semibold text-stone-400">{role.city} · Posted {role.age}</p>
                    </div>
                    <span className="font-black text-sky-400">{role.fit}% fit</span>
                    <span className="rounded-full border border-stone-600 px-3 py-1 text-center text-sm font-black">{role.mode}</span>
                    <button className="rounded-xl bg-[#f97316] px-3 py-2 font-black text-black">Save</button>
                  </div>
                ))}
              </div>
            </div>
            <aside className="space-y-4">
              <div className="rounded-3xl border border-stone-700 bg-[#22201d] p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f97316]">Pipeline</p>
                <div className="mt-4 grid gap-3">
                  {pipeline.map((stage) => (
                    <div key={stage.label} className="flex items-center justify-between rounded-2xl bg-black/25 px-4 py-3">
                      <span className="font-bold text-stone-300">{stage.label}</span>
                      <span className="text-2xl font-black text-white">{stage.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-stone-700 bg-[#22201d] p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f97316]">Security</p>
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-sky-500/10 p-4 text-sky-300">
                  <ShieldCheck size={22} />
                  <p className="font-black">Private board enabled</p>
                </div>
              </div>
            </aside>
          </section>
        </div>
      </section>
    </ConceptShell>
  );
}

export function LiftOsConcept() {
  return (
    <ConceptShell title="V5 Lift OS" subtitle="Soft modern workspace" background="bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_48%,#ecfdf5_100%)] text-slate-950">
      <section className="rounded-[2rem] border border-white bg-white/75 p-4 shadow-soft backdrop-blur-xl">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <LogoMark className="bg-[#2563eb] text-white" />
            <p className="text-xl font-black">CareerUp</p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {navItems.map((item, index) => (
              <span key={item} className={`rounded-full px-4 py-2 text-sm font-black ${index === 0 ? "bg-[#2563eb] text-white" : "bg-slate-100 text-slate-600"}`}>
                {item}
              </span>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="rounded-2xl bg-slate-100 p-3"><Bell size={18} /></span>
            <span className="rounded-2xl bg-[#2563eb] px-4 py-3 font-black text-white">Varun</span>
          </div>
        </header>

        <div className="grid gap-5 p-4 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-5">
            <div className="rounded-[2rem] bg-[#0f172a] p-7 text-white">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">Today’s climb</p>
                  <h1 className="mt-3 max-w-2xl text-5xl font-black leading-tight">Move one role forward, keep the streak alive.</h1>
                </div>
                <button className="rounded-2xl bg-white px-5 py-3 font-black text-slate-950">Find roles</button>
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <MiniMetric label="XP" value="145" icon={Trophy} dark />
                <MiniMetric label="Streak" value="6" icon={Flame} dark />
                <MiniMetric label="Goal" value="4/7" icon={Target} dark />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {roles.slice(0, 2).map((role) => (
                <div key={role.company} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[#2563eb]">{role.company}</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950">{role.title}</h3>
                    </div>
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-black text-sky-700">{role.fit}%</span>
                  </div>
                  <p className="mt-4 font-semibold text-slate-500">{role.city} · {role.mode}</p>
                  <div className="mt-5 flex gap-2">
                    <button className="flex-1 rounded-2xl bg-[#2563eb] px-4 py-3 font-black text-white">Save</button>
                    <button className="rounded-2xl border border-slate-200 px-4 py-3 font-black text-slate-700"><ArrowUpRight size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="grid gap-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Board</p>
                  <h2 className="text-2xl font-black">Application flow</h2>
                </div>
                <LineChart className="text-[#2563eb]" />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {pipeline.map((stage) => (
                  <div key={stage.label} className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-bold text-slate-500">{stage.label}</p>
                    <p className="mt-2 text-3xl font-black text-slate-950">{stage.count}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Rewards</p>
              <div className="mt-4 grid gap-3">
                {["Interview question pack", "Resume bullet scorer", "Referral message kit"].map((reward, index) => (
                  <div key={reward} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      {index === 0 ? <Star className="text-amber-500" /> : index === 1 ? <Sparkles className="text-blue-500" /> : <LockKeyhole className="text-sky-500" />}
                      <span className="font-black">{reward}</span>
                    </div>
                    <span className="text-sm font-black text-slate-500">{120 + index * 60} XP</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </ConceptShell>
  );
}
