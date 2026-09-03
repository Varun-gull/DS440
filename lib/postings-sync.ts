import { fetchCuratedGithubPostings, fetchJobrightPostings, getPostingRecencyScore, type PostingKind } from "@/lib/postings";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InternshipPosting } from "@/lib/types";

type SyncResult = {
  kind: PostingKind;
  fetched: number;
  saved: number;
  error?: string;
};

const SYNC_KINDS: PostingKind[] = ["internship", "new-grad"];
const UPSERT_CHUNK_SIZE = 500;

function buildPostingKey(kind: PostingKind, posting: InternshipPosting) {
  return `${kind}:${posting.id}`;
}

function toCacheRow(kind: PostingKind, posting: InternshipPosting) {
  return {
    posting_key: buildPostingKey(kind, posting),
    kind,
    company: posting.company,
    title: posting.title,
    location: posting.location || "United States",
    source: posting.source,
    source_url: posting.url,
    work_mode: posting.workMode,
    remote: posting.remote,
    posted_at_label: posting.postedAt || "Recently",
    recency_score: getPostingRecencyScore(posting.postedAt),
    tags: posting.tags,
    tags_text: posting.tags.join(" "),
    description: posting.description,
    last_seen_at: new Date().toISOString(),
    raw: posting,
  };
}

async function syncPostingKind(kind: PostingKind): Promise<SyncResult> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      kind,
      fetched: 0,
      saved: 0,
      error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const postings = [
    ...(await fetchJobrightPostings(kind)),
    ...(await fetchCuratedGithubPostings(kind)),
  ];
  const rows = postings.map((posting) => toCacheRow(kind, posting));
  let saved = 0;

  for (let index = 0; index < rows.length; index += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(index, index + UPSERT_CHUNK_SIZE);
    const { error } = await supabase
      .from("postings")
      .upsert(chunk, { onConflict: "posting_key" });

    if (error) {
      return {
        kind,
        fetched: postings.length,
        saved,
        error: error.message,
      };
    }

    saved += chunk.length;
  }

  return {
    kind,
    fetched: postings.length,
    saved,
  };
}

export async function syncPostingCache(kinds: PostingKind[] = SYNC_KINDS) {
  const results: SyncResult[] = [];

  for (const kind of kinds) {
    results.push(await syncPostingKind(kind));
  }

  return {
    syncedAt: new Date().toISOString(),
    results,
    ok: results.every((result) => !result.error),
  };
}
