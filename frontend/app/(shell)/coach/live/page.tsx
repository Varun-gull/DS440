import { CareerAssistant } from "@/components/CareerAssistant";
import { CoachHeader } from "@/components/CoachHeader";

export const dynamic = "force-dynamic";

export default function LiveInterviewPage() {
  return <main className="page-shell coach-page"><CoachHeader active="live" /><CareerAssistant key="live" view="live" /></main>;
}
