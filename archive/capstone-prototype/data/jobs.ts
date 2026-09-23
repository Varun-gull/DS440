export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: "Remote" | "Hybrid" | "On site";
  type: "Internship" | "Entry level";
  source: string;
  posted: string;
  match: number;
  skills: string[];
  summary: string;
};

export const sampleJobs: Job[] = [
  {
    id: "job-1",
    title: "Data Science Intern",
    company: "Northstar Analytics",
    location: "New York, NY",
    workMode: "Hybrid",
    type: "Internship",
    source: "SimplifyJobs",
    posted: "Today",
    match: 86,
    skills: ["Python", "SQL", "Data visualization"],
    summary: "Support analytics projects, prepare datasets, and communicate findings to product teams."
  },
  {
    id: "job-2",
    title: "Business Intelligence Intern",
    company: "Brightwell Health",
    location: "Philadelphia, PA",
    workMode: "Remote",
    type: "Internship",
    source: "Jobright",
    posted: "1 day ago",
    match: 81,
    skills: ["SQL", "Tableau", "Communication"],
    summary: "Build reporting dashboards and help business teams understand operational performance."
  },
  {
    id: "job-3",
    title: "Junior Data Analyst",
    company: "Atlas Commerce",
    location: "Boston, MA",
    workMode: "Hybrid",
    type: "Entry level",
    source: "SpeedyApply",
    posted: "2 days ago",
    match: 74,
    skills: ["Excel", "SQL", "Reporting"],
    summary: "Analyze customer and sales data while maintaining recurring reports for leadership."
  },
  {
    id: "job-4",
    title: "Product Analytics Intern",
    company: "Pathway Labs",
    location: "Remote, USA",
    workMode: "Remote",
    type: "Internship",
    source: "Zapply",
    posted: "3 days ago",
    match: 70,
    skills: ["Analytics", "A B testing", "Product strategy"],
    summary: "Partner with product managers to measure feature performance and user engagement."
  },
  {
    id: "job-5",
    title: "Research Data Assistant",
    company: "Civic Futures Institute",
    location: "Washington, DC",
    workMode: "On site",
    type: "Entry level",
    source: "Jobright",
    posted: "4 days ago",
    match: 67,
    skills: ["Research", "Python", "Writing"],
    summary: "Clean research datasets and prepare clear summaries for public policy projects."
  }
];
