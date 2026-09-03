import { NextResponse } from "next/server";
import { syncPostingCache } from "@/lib/postings-sync";
import type { PostingKind } from "@/lib/postings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseKinds(value: string | null): PostingKind[] | undefined {
  if (value === "internship") {
    return ["internship"];
  }

  if (value === "new-grad") {
    return ["new-grad"];
  }

  return undefined;
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization");
  const querySecret = new URL(request.url).searchParams.get("secret");

  return authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const result = await syncPostingCache(parseKinds(url.searchParams.get("kind")));

  return NextResponse.json(result, {
    status: result.ok ? 200 : 500,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
