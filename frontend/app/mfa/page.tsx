import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { MfaChallengeForm } from "@/components/MfaChallengeForm";
import { logOut } from "@/lib/auth/actions";
import { getSafeRedirectPath } from "@/lib/auth/mfa";
import { getCurrentUser } from "@/lib/data";

export default async function MfaPage({ searchParams: searchParamsInput }: { searchParams?: Promise<{ next?: string }> }) {
  const searchParams = await searchParamsInput;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?message=Log in before entering your authenticator code.");
  }

  const nextPath = getSafeRedirectPath(searchParams?.next);

  return (
    <AuthShell
      eyebrow="Security check"
      title="Enter your authenticator code"
      description="Your password was accepted. Complete the second verification step to open CareerUp."
    >
      <MfaChallengeForm nextPath={nextPath} />
      <form action={logOut} className="mt-4">
        <button type="submit" className="secondary-button w-full">Sign out</button>
      </form>
    </AuthShell>
  );
}
