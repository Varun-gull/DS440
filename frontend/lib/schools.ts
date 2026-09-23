export type SchoolOption = {
  name: string;
  domain: string;
};

export const schoolOptions: SchoolOption[] = [
  { name: "Arizona State University", domain: "asu.edu" },
  { name: "Boston University", domain: "bu.edu" },
  { name: "Brown University", domain: "brown.edu" },
  { name: "California Institute of Technology", domain: "caltech.edu" },
  { name: "Carnegie Mellon University", domain: "cmu.edu" },
  { name: "Columbia University", domain: "columbia.edu" },
  { name: "Cornell University", domain: "cornell.edu" },
  { name: "Dartmouth College", domain: "dartmouth.edu" },
  { name: "Duke University", domain: "duke.edu" },
  { name: "Emory University", domain: "emory.edu" },
  { name: "Florida State University", domain: "fsu.edu" },
  { name: "Georgia Institute of Technology", domain: "gatech.edu" },
  { name: "Harvard University", domain: "harvard.edu" },
  { name: "Indiana University Bloomington", domain: "iu.edu" },
  { name: "Johns Hopkins University", domain: "jhu.edu" },
  { name: "Massachusetts Institute of Technology", domain: "mit.edu" },
  { name: "New York University", domain: "nyu.edu" },
  { name: "Northeastern University", domain: "northeastern.edu" },
  { name: "Northwestern University", domain: "northwestern.edu" },
  { name: "Ohio State University", domain: "osu.edu" },
  { name: "Pennsylvania State University", domain: "psu.edu" },
  { name: "Princeton University", domain: "princeton.edu" },
  { name: "Purdue University", domain: "purdue.edu" },
  { name: "Rice University", domain: "rice.edu" },
  { name: "Rutgers University", domain: "rutgers.edu" },
  { name: "Stanford University", domain: "stanford.edu" },
  { name: "Stevens Institute of Technology", domain: "stevens.edu" },
  { name: "Texas A&M University", domain: "tamu.edu" },
  { name: "University of California, Berkeley", domain: "berkeley.edu" },
  { name: "University of California, Los Angeles", domain: "ucla.edu" },
  { name: "University of Chicago", domain: "uchicago.edu" },
  { name: "University of Florida", domain: "ufl.edu" },
  { name: "University of Illinois Urbana-Champaign", domain: "illinois.edu" },
  { name: "University of Maryland", domain: "umd.edu" },
  { name: "University of Michigan", domain: "umich.edu" },
  { name: "University of North Carolina at Chapel Hill", domain: "unc.edu" },
  { name: "University of Pennsylvania", domain: "upenn.edu" },
  { name: "University of Southern California", domain: "usc.edu" },
  { name: "University of Texas at Austin", domain: "utexas.edu" },
  { name: "University of Virginia", domain: "virginia.edu" },
  { name: "University of Washington", domain: "washington.edu" },
  { name: "University of Wisconsin-Madison", domain: "wisc.edu" },
  { name: "Vanderbilt University", domain: "vanderbilt.edu" },
  { name: "Virginia Tech", domain: "vt.edu" },
  { name: "Yale University", domain: "yale.edu" }
];

export function getSchoolLogoUrl(schoolName: string) {
  const normalizedName = schoolName.trim().toLowerCase();
  const school = schoolOptions.find((option) => option.name.toLowerCase() === normalizedName);
  return school ? `https://www.google.com/s2/favicons?domain=${school.domain}&sz=64` : "";
}
