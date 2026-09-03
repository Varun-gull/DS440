import { PageHero } from "@/components/PageHero";
import { CalendarView } from "@/components/CalendarView";
import { getApplications, getCalendarEvents } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [applications, dbEvents] = await Promise.all([getApplications(), getCalendarEvents()]);

  return (
    <>
      <main className="page-shell">
        <PageHero
          compact
          eyebrow="Schedule"
          title="Calendar"
          description="Drag applications onto dates to track deadlines and submissions."
        />
        <div className="mb-6" />
        <CalendarView applications={applications} dbEvents={dbEvents} />
      </main>
    </>
  );
}
