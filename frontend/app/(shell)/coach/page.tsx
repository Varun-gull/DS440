import { CareerAssistant } from "@/components/CareerAssistant";
import { CoachHeader } from "@/components/CoachHeader";

export const dynamic = "force-dynamic";

export default function CoachChatPage() {
  return <main className="page-shell coach-page"><CoachHeader active="chat" /><CareerAssistant key="chat" view="chat" /></main>;
}
