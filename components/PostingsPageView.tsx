import { ChevronLeft, ChevronRight, RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { PageHero } from "@/components/PageHero";
import { PostingsSearchForm } from "@/components/PostingsSearchForm";
import { PostingsTable } from "@/components/PostingsTable";
import { RolePeerSetupNotice } from "@/components/RolePeerSetupNotice";
import { getApplications, getCurrentProfile, getRolePeerFeatureStatus, getRolePeerInsights } from "@/lib/data";
import { getPostingRecencyScore, searchCachedPostings, searchInternshipPostings, type PostingKind } from "@/lib/postings";
import { buildRoleKey } from "@/lib/role-key";
import type { InternshipPosting } from "@/lib/types";

type RemoteFilter = "all" | "remote" | "hybrid" | "onsite";
type PostingSort = "fit" | "newest" | "company";

const internshipRoleExamples = [
  "Software Engineering Intern",
  "Data Science Intern",
  "Machine Learning Intern",
  "AI Intern",
  "Product Management Intern",
  "Data Analyst Intern",
  "Frontend Intern",
  "Backend Intern",
  "Cybersecurity Intern"
];

const newGradRoleExamples = [
  "Software Engineer New Grad",
  "Data Analyst New Grad",
  "Machine Learning Engineer New Grad",
  "Associate Product Manager",
  "Business Analyst New Grad",
  "Cloud Engineer Entry Level",
  "AI Engineer New Grad"
];

const locationExamples = ["Remote", "Hybrid", "New York", "San Francisco", "Washington DC", "Seattle", "Boston", "Austin", "Chicago"];
const POSTINGS_PER_PAGE = 50;
const POSTINGS_FETCH_LIMIT = 2000;

function uniqueExamples(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 12);
}

function filterPostings(postings: InternshipPosting[], remote: RemoteFilter, minFit: number) {
  return postings.filter((posting) => {
    const remoteMatch = remote === "all" || posting.workMode === remote;
    return remoteMatch && posting.fitScore >= minFit;
  });
}

function sortPostings(postings: InternshipPosting[], sort: PostingSort) {
  return [...postings].sort((a, b) => {
    if (sort === "company") {
      return a.company.localeCompare(b.company);
    }

    if (sort === "newest") {
      const aRecency = getPostingRecencyScore(a.postedAt);
      const bRecency = getPostingRecencyScore(b.postedAt);

      if (aRecency === bRecency) {
        return 0;
      }

      return aRecency - bRecency;
    }

    const fitDifference = b.fitScore - a.fitScore;

    if (fitDifference !== 0) {
      return fitDifference;
    }

    const aRecency = getPostingRecencyScore(a.postedAt);
    const bRecency = getPostingRecencyScore(b.postedAt);

    if (aRecency === bRecency) {
      return 0;
    }

    return aRecency - bRecency;
  });
}

function mergePostings(postings: InternshipPosting[]) {
  const collected = new Map<string, InternshipPosting>();

  postings.forEach((posting) => {
    const urlKey = posting.url.replace(/[?#].*$/, "").toLowerCase();
    const fallbackKey = `${posting.company}-${posting.title}-${posting.location}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const key = urlKey || fallbackKey;
    const existing = collected.get(key);

    if (!existing || posting.fitScore > existing.fitScore) {
      collected.set(key, posting);
    }
  });

  return Array.from(collected.values());
}

function buildPostingsHref(
  kind: PostingKind,
  searchParams?: { q?: string; location?: string; remote?: RemoteFilter; minFit?: string; sort?: PostingSort },
  overrides?: { sort?: PostingSort; page?: number }
) {
  const basePath = kind === "new-grad" ? "/postings/new-grad" : "/postings/internships";
  const params = new URLSearchParams();

  if (searchParams?.q) params.set("q", searchParams.q);
  if (searchParams?.location) params.set("location", searchParams.location);
  if (searchParams?.remote) params.set("remote", searchParams.remote);
  if (searchParams?.minFit) params.set("minFit", searchParams.minFit);
  params.set("sort", overrides?.sort ?? searchParams?.sort ?? "newest");
  if (overrides?.page && overrides.page > 1) params.set("page", String(overrides.page));

  return `${basePath}?${params.toString()}`;
}

function getPaginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);

  if (currentPage <= 4) {
    [2, 3, 4, 5].forEach((page) => pages.add(page));
  }

  if (currentPage >= totalPages - 3) {
    [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1].forEach((page) => pages.add(page));
  }

  const validPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];

  validPages.forEach((page, index) => {
    const previousPage = validPages[index - 1];

    if (previousPage && page - previousPage > 1) {
      items.push("ellipsis");
    }

    items.push(page);
  });

  return items;
}

async function searchPostingsWithFallback({
  query,
  location,
  profile,
  kind,
  remote,
  minFit,
  sort,
}: {
  query: string;
  location: string;
  profile: Awaited<ReturnType<typeof getCurrentProfile>>;
  kind: PostingKind;
  remote: RemoteFilter;
  minFit: number;
  sort: PostingSort;
}) {
  const hasSubmittedSearch = Boolean(query || location);
  const cachedSearchResult = await searchCachedPostings({
    query,
    location,
    profile,
    kind,
    remote,
    minFit,
    sort,
    limit: POSTINGS_FETCH_LIMIT
  });

  if (hasSubmittedSearch) {
    const liveSearchResult = await searchInternshipPostings({
      query,
      location,
      profile,
      kind
    });
    const livePostings = liveSearchResult.usingFallback ? [] : liveSearchResult.postings;
    const mergedPostings = mergePostings([...(cachedSearchResult?.postings ?? []), ...livePostings]);

    return {
      ...liveSearchResult,
      usingFallback: false,
      postings: mergedPostings
    };
  }

  if (cachedSearchResult?.postings.length) {
    return cachedSearchResult;
  }

  return searchInternshipPostings({
    query,
    location,
    profile,
    kind
  });
}

export async function PostingsPageView({
  kind,
  searchParams,
}: {
  kind: PostingKind;
  searchParams?: {
    q?: string;
    location?: string;
    remote?: RemoteFilter;
    minFit?: string;
    sort?: PostingSort;
    page?: string;
    message?: string;
  };
}) {
  const profile = await getCurrentProfile();
  const remoteFilter = searchParams?.remote === "remote" || searchParams?.remote === "hybrid" || searchParams?.remote === "onsite" ? searchParams.remote : "all";
  const sort = searchParams?.sort === "fit" || searchParams?.sort === "company" ? searchParams.sort : "newest";
  const minFit = Math.min(95, Math.max(0, Number(searchParams?.minFit ?? 0) || 0));
  const requestedPage = Math.max(1, Number(searchParams?.page ?? 1) || 1);
  const submittedQuery = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
  const submittedLocation = typeof searchParams?.location === "string" ? searchParams.location.trim() : "";
  const roleExamples = kind === "new-grad" ? newGradRoleExamples : internshipRoleExamples;
  const roleSuggestions = uniqueExamples([...profile.targetRoles, ...profile.resumeKeywords, ...roleExamples]);
  const locationSuggestions = uniqueExamples([...profile.targetLocations, ...locationExamples]);
  const searchResult = await searchPostingsWithFallback({
    query: submittedQuery,
    location: submittedLocation,
    profile,
    kind,
    remote: remoteFilter,
    minFit,
    sort
  });
  const applications = await getApplications();
  const savedSourceUrls = new Set(applications.map((application) => application.source).filter((source) => source.startsWith("http")));
  const allPostings = searchResult.cached ? searchResult.postings : sortPostings(filterPostings(searchResult.postings, remoteFilter, minFit), sort);
  const totalPages = Math.max(1, Math.ceil(allPostings.length / POSTINGS_PER_PAGE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * POSTINGS_PER_PAGE;
  const postings = allPostings.slice(pageStart, pageStart + POSTINGS_PER_PAGE);
  const [peerInsights, peerFeatureStatus] = await Promise.all([
    getRolePeerInsights(postings.map((posting) => buildRoleKey(posting.company, posting.title))),
    getRolePeerFeatureStatus()
  ]);
  const pageTitle = kind === "new-grad" ? "New grad postings" : "Internship postings";
  const pageCopy =
    kind === "new-grad"
      ? "Search current entry-level and new graduate roles from Jobright, Intern-list, and curated GitHub sources."
      : "Search current internship-style roles from Jobright, Intern-list, and curated GitHub sources.";
  const resetHref = kind === "new-grad" ? "/postings/new-grad" : "/postings/internships";
  const returnHref = buildPostingsHref(kind, searchParams, { page: currentPage });
  const bestFitHref = buildPostingsHref(kind, searchParams, { sort: "fit", page: 1 });
  const newestHref = buildPostingsHref(kind, searchParams, { sort: "newest", page: 1 });
  const paginationItems = getPaginationItems(currentPage, totalPages);

  return (
    <>
      <main className="page-shell">
        <PageHero
          compact
          eyebrow="Live search"
          title={pageTitle}
          description={pageCopy}
          tabs={[
            {
              label: "Internships",
              href: "/postings/internships",
              active: kind === "internship",
            },
            {
              label: "New Grad",
              href: "/postings/new-grad",
              active: kind === "new-grad",
            },
          ]}
        />

        {searchParams?.message && <p className="mt-5 rounded-2xl border border-sky/20 bg-[#EAF2F8] p-3 text-sm font-bold text-[#2A6384]">{searchParams.message}</p>}
        <RolePeerSetupNotice status={peerFeatureStatus} />

        <PostingsSearchForm
          kind={kind}
          roleSuggestions={roleSuggestions}
          locationSuggestions={locationSuggestions}
          defaultQuery={submittedQuery}
          defaultLocation={submittedLocation}
          locationPlaceholder={profile.targetLocations[0] ?? "Remote"}
          remoteFilter={remoteFilter}
          minFit={minFit}
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-white/80 bg-white/55 px-4 py-3 text-sm font-medium text-slate-600 shadow-sm backdrop-blur-xl">
          <Link href={resetHref} className="inline-flex items-center rounded-full bg-white/75 px-3 py-1 text-xs text-slate-700 shadow-sm ring-1 ring-white/80 transition hover:bg-[#EAF2F8] hover:text-[#2A6384]">
            <RotateCcw className="mr-1" size={14} /> Reset
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span>
              {allPostings.length > 0 ? `Showing ${pageStart + 1}-${pageStart + postings.length} of ${allPostings.length} results` : "Showing 0 results"}
              {searchResult.cached ? " from cache" : ""}
            </span>
            {allPostings.length > 0 && (
              <span className="rounded-full bg-white/80 px-3 py-1 metric text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-white/80">
                Page {currentPage} of {totalPages}
              </span>
            )}
            <span className="inline-flex overflow-hidden rounded-full bg-white/70 text-xs font-bold shadow-sm ring-1 ring-white/80">
              <Link href={bestFitHref} className={sort === "fit" ? "bg-[#2A6384] px-3 py-1 text-white" : "px-3 py-1 text-slate-600 transition hover:bg-[#EAF2F8] hover:text-[#2A6384]"}>
                Best fit
              </Link>
              <Link href={newestHref} className={sort === "newest" ? "bg-[#2A6384] px-3 py-1 text-white" : "px-3 py-1 text-slate-600 transition hover:bg-[#EAF2F8] hover:text-[#2A6384]"}>
                Latest posted
              </Link>
            </span>
          </div>
        </div>

        {postings.length > 0 ? (
          <>
            <PostingsTable postings={postings} returnTo={returnHref} savedSourceUrls={savedSourceUrls} peerInsights={peerInsights} />
            {totalPages > 1 && (
              <nav className="mt-5 flex flex-wrap items-center justify-end gap-1 text-sm font-bold" aria-label="Posting pages">
                <Link
                  href={buildPostingsHref(kind, searchParams, { page: Math.max(1, currentPage - 1) })}
                  className={`flex items-center gap-1 rounded-xl px-3 py-2 transition ${currentPage === 1 ? "pointer-events-none text-slate-300" : "text-slate-600 hover:bg-slate-100 hover:text-[#2A6384]"}`}
                  aria-disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} /> Previous
                </Link>

                {paginationItems.map((item, index) =>
                  item === "ellipsis" ? (
                    <span key={`ellipsis-${index}`} className="px-2 py-2 text-slate-400">...</span>
                  ) : (
                    <Link
                      key={item}
                      href={buildPostingsHref(kind, searchParams, { page: item })}
                      className={`min-w-[2.25rem] rounded-xl px-3 py-2 text-center transition ${
                        item === currentPage
                          ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-700"
                          : "text-slate-600 hover:bg-slate-100 hover:text-[#2A6384]"
                      }`}
                      aria-current={item === currentPage ? "page" : undefined}
                    >
                      {item}
                    </Link>
                  )
                )}

                <Link
                  href={buildPostingsHref(kind, searchParams, { page: Math.min(totalPages, currentPage + 1) })}
                  className={`flex items-center gap-1 rounded-xl px-3 py-2 transition ${currentPage === totalPages ? "pointer-events-none text-slate-300" : "text-slate-600 hover:bg-slate-100 hover:text-[#2A6384]"}`}
                  aria-disabled={currentPage === totalPages}
                >
                  Next <ChevronRight size={16} />
                </Link>
              </nav>
            )}
          </>
        ) : (
          <div className="mt-8">
            <EmptyState icon={Search} title="No postings found" description="Try a broader keyword, clear the location, or lower the minimum fit." actionHref={resetHref} actionLabel="Reset search" />
          </div>
        )}
      </main>
    </>
  );
}
