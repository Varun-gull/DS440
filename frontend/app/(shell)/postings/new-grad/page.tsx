import { PostingsPageView } from "@/components/PostingsPageView";

export default async function NewGradPostingsPage({
  searchParams: searchParamsInput,
}: {
  searchParams?: Promise<{
    q?: string;
    location?: string;
    remote?: "all" | "remote" | "hybrid" | "onsite";
    minFit?: string;
    sort?: "fit" | "newest" | "company";
    page?: string;
    message?: string;
  }>;
}) {
  const searchParams = await searchParamsInput;
  return <PostingsPageView kind="new-grad" searchParams={searchParams} />;
}
