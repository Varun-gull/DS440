import type { Reward } from "@/lib/types";

export const rewardCatalog: Array<Omit<Reward, "unlocked">> = [
  {
    id: "behavioral-interview-pack",
    title: "Behavioral Interview Prep Kit",
    description: "Unlock STAR prompts, answer structure, and story checkpoints for behavioral interviews.",
    category: "Interview prep",
    xpCost: 28,
    contents: [
      "Core prompts: conflict, leadership, failure, fast learning, teamwork, and technical problem solving.",
      "STAR structure: 15 seconds for context, 15 for your task, 45 for action, 15 for result.",
      "Story bank checklist: project story, team story, challenge story, and growth story.",
      "Final pass: add one metric, one tradeoff, and one lesson to every answer."
    ]
  },
  {
    id: "recruiter-message-kit",
    title: "Recruiter Outreach Pack",
    description: "Message templates for recruiters, alumni, referrals, and follow-ups after applying.",
    category: "Networking",
    xpCost: 26,
    contents: [
      "Recruiter opener: role interest, one matching project, and one clear next step.",
      "Alumni message: shared school connection, concise background, and 15-minute call ask.",
      "Referral ask: role link, two matching proof points, and a polished resume note.",
      "Follow-up cadence: 4 business days after outreach, 7 to 10 business days after applying."
    ]
  },
  {
    id: "technical-screen-checklist",
    title: "Technical Screen Prep Plan",
    description: "A focused prep plan for SWE, data, product, and technical internship interviews.",
    category: "Technical prep",
    xpCost: 35,
    contents: [
      "SWE track: arrays, hash maps, strings, sorting, recursion, graphs, complexity, and edge cases.",
      "Data track: SQL joins, grouping, window functions, experiment metrics, and dashboard storytelling.",
      "Project deep dive: goal, stack, tradeoffs, bug, metric, and next improvement.",
      "Mock flow: clarify, outline approach, solve, test, discuss complexity, and summarize."
    ]
  },
  {
    id: "application-quality-audit",
    title: "High-Priority Application Checklist",
    description: "A submission checklist for roles you care about most, before you hit apply.",
    category: "Applications",
    xpCost: 16,
    contents: [
      "Match the resume headline or top project to the role's core skill.",
      "Add three truthful keywords from the posting into the resume or short answers.",
      "Check that LinkedIn, GitHub, portfolio, and resume links open correctly.",
      "Use a company-specific sentence instead of a generic interest statement.",
      "Save the role, deadline, and follow-up reminder in CareerUp."
    ]
  },
  {
    id: "company-research-template",
    title: "Company Research Brief",
    description: "Turn any job posting into a short company brief before applying or interviewing.",
    category: "Research",
    xpCost: 18,
    contents: [
      "Company snapshot: mission, product, customer, and recent company news.",
      "Role match: three posting details that connect to your projects or coursework.",
      "Team questions: ask about intern ownership, mentorship, metrics, and return offers.",
      "Interview angle: one reason the company fits your goals beyond brand name."
    ]
  },
  {
    id: "resume-bullet-scorer",
    title: "Resume Keyword Tailor Kit",
    description: "A practical way to tailor your resume without changing the original upload.",
    category: "Resume",
    xpCost: 30,
    contents: [
      "Pull 5 to 8 important keywords from the posting: tools, skills, responsibilities, and domain words.",
      "Map each keyword to an honest resume proof point: project, class, job, or club work.",
      "Rewrite bullets with action verb, tool, task, result, and measurable impact.",
      "Keep the master resume untouched; create a role-specific copy for that application.",
      "Remove filler before adding keywords so the resume stays readable."
    ]
  },
  {
    id: "follow-up-calendar-system",
    title: "Follow-up Calendar System",
    description: "A timing system for application follow-ups, interview thank-yous, and recruiter nudges.",
    category: "Organization",
    xpCost: 20,
    contents: [
      "Application follow-up: 7 to 10 business days after applying.",
      "Recruiter message follow-up: 4 business days after no response.",
      "Interview thank-you: same day, ideally within 6 hours.",
      "Final status check: one week after the promised decision window.",
      "Close the loop politely when you accept another offer."
    ]
  },
  {
    id: "cold-email-outline",
    title: "Networking Tracker Template",
    description: "A simple system for tracking who you contacted, what you asked, and when to follow up.",
    category: "Networking",
    xpCost: 19,
    contents: [
      "Track contact name, company, source, relationship, message date, and follow-up date.",
      "Log the ask: referral, coffee chat, resume review, recruiter screen, or hiring manager intro.",
      "Add one personal detail from the conversation so follow-ups feel human.",
      "Use statuses: queued, sent, replied, call booked, referred, closed.",
      "Review the tracker twice a week to avoid missed follow-ups."
    ]
  },
  {
    id: "offer-negotiation-primer",
    title: "Offer Decision Kit",
    description: "Compare offers clearly and prepare professional questions before making a decision.",
    category: "Offers",
    xpCost: 48,
    contents: [
      "Compare hourly pay, housing, relocation, return offer rate, team quality, and project scope.",
      "Ask about mentor assignment, intern conversion process, performance expectations, and project ownership.",
      "Score each offer by learning value, resume value, network value, compensation, and location fit.",
      "Use a polite negotiation frame: appreciation, competing context, specific ask, flexibility.",
      "Never invent competing offers or deadlines."
    ]
  },
  {
    id: "rejection-recovery-plan",
    title: "Rejection Recovery Plan",
    description: "Turn a rejection into feedback, a future contact, and a better next application.",
    category: "Applications",
    xpCost: 12,
    contents: [
      "Reply within 24 hours: thank them, and ask one specific question about what would have made you a stronger candidate.",
      "Connect with the recruiter on LinkedIn with a short, positive note — teams remember gracious candidates.",
      "Log the rejection stage (resume screen, phone screen, final round) to spot patterns across applications.",
      "If you reached interviews, ask whether they encourage re-applying next cycle and note the date.",
      "Do one concrete improvement before your next application: one resume bullet, one practice problem, or one mock answer."
    ]
  },
  {
    id: "referral-ask-playbook",
    title: "Referral Ask Playbook",
    description: "Scripts for asking employees and alumni for referrals without being awkward.",
    category: "Networking",
    xpCost: 22,
    contents: [
      "Target people with a real connection: same school, same club, mutual friend, or someone whose work you can genuinely reference.",
      "Warm contact script: remind them how you know each other, name the exact role + link, attach resume, and make saying no easy.",
      "Cold alumni script: school connection, one-line background, the role, and a 15-minute chat ask before any referral ask.",
      "Never ask a stranger for a referral in the first message — ask for a conversation first.",
      "Follow up once after 5 business days, then let it go. Always send a thank-you whether or not the referral happens."
    ]
  },
  {
    id: "phone-screen-survival-kit",
    title: "Phone Screen Survival Kit",
    description: "Everything to have ready for the first-round recruiter or phone screen call.",
    category: "Interview prep",
    xpCost: 28,
    contents: [
      "Prepare a 60-second 'tell me about yourself': year + school, one strong project, why this company, what you want to do.",
      "Have answers ready for: availability dates, work authorization, location preference, and expected graduation.",
      "Keep your resume, the job posting, and your project notes open on screen during the call.",
      "Prepare two questions for the recruiter: one about the team, one about the process timeline.",
      "End by asking about next steps and the decision timeline, then send a same-day thank-you email."
    ]
  },
  {
    id: "linkedin-profile-audit",
    title: "LinkedIn Profile Audit",
    description: "A section-by-section rubric to make your LinkedIn recruiter-ready.",
    category: "Profile",
    xpCost: 26,
    contents: [
      "Headline: role you want + strongest proof point, not just 'Student at X' (e.g. 'CS @ GMU · SWE Intern @ Startup · Building ML side projects').",
      "About: 3-4 sentences — what you're studying, what you've built, what role you're seeking, how to reach you.",
      "Experience: copy your best resume bullets with metrics; add media links to projects where possible.",
      "Skills: pin the top 3 that match your target roles; remove filler skills.",
      "Set 'Open to Work' for internships visible to recruiters only, and add target locations.",
      "Photo and banner: clear headshot, and a banner related to your field beats the default."
    ]
  },
  {
    id: "career-fair-game-plan",
    title: "Career Fair Game Plan",
    description: "A before/during/after checklist to turn career fairs into interviews.",
    category: "Networking",
    xpCost: 18,
    contents: [
      "Before: pick 5 target companies, read what each is hiring for, and prepare one specific question per company.",
      "Prepare a 30-second pitch: name, year + major, strongest project or experience, and what role you're looking for.",
      "Print 10+ resumes on quality paper; bring a folder so they stay flat.",
      "During: visit a non-target company first as warm-up, take notes on every conversation immediately after.",
      "Ask every recruiter for their name and how to follow up — a business card or LinkedIn.",
      "After: connect on LinkedIn within 24 hours referencing your exact conversation, and apply online the same day."
    ]
  }
];
