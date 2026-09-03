# Project Overview

## Problem

Internship and entry-level job searches are repetitive and fragmented. Students often switch among job boards, spreadsheets, calendars, resume documents, and messaging tools. This makes it easy to lose opportunities, miss deadlines, and stop applying consistently.

## Proposed Solution

CareerUp brings the recruiting workflow into one interactive platform. Students can discover positions, compare them with their profile, save opportunities, manage application stages, schedule recruiting events, prepare for interviews, and monitor progress.

Motivational features make the process more engaging without turning the platform into a game. XP, streaks, challenges, badges, ranks, rewards, and optional leaderboards provide feedback and accountability around real career tasks.

## Target Users

- College students seeking internships
- Graduating students seeking entry-level roles
- Friends or classmates who want private recruiting accountability

## Primary User Flow

1. Create an account.
2. Complete a career profile.
3. Upload a resume.
4. Search internship or new-graduate postings.
5. Review fit scores and source links.
6. Save a role to the application pipeline.
7. Move it through saved, applied, interviewing, offer, or rejected.
8. Track deadlines and interviews on the calendar.
9. Earn progress rewards and complete challenges.
10. Optionally connect with friends, groups, and relevant peers.

## Research Question

Can an AI-assisted job platform produce more accurate, useful, and understandable resume-to-job recommendations than a transparent keyword-matching baseline while encouraging students to apply more consistently?

## Current Baseline

The current system is rule-based. It parses resume text, extracts known keywords, and calculates a fit score using target-role overlap, location preferences, work mode, and skill matches. It does not currently call a generative-AI model.

This baseline is intentional: the later AI system can be evaluated against the same resumes and job descriptions.

## Success Measures

- Accuracy of extracted skills
- Agreement between fit scores and human judgments
- Usefulness and clarity of explanations
- Unsupported or misleading recommendation rate
- Time required to evaluate a posting
- User engagement with application tasks
- AI latency and cost
- Privacy and security failures

## Scope Boundaries

CareerUp does not automatically apply to jobs, make hiring decisions, guarantee qualification, invent resume experience, or scrape restricted job platforms. Users remain responsible for reviewing every recommendation and submitting their own applications.

