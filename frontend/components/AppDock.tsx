import { NavDock } from "@/components/NavDock";
import { getCurrentUser, getUnreadPeerMessageCount } from "@/lib/data";

export async function AppDock() {
  const user = await getCurrentUser();
  const unreadMessages = user ? await getUnreadPeerMessageCount() : 0;

  return <NavDock unreadMessages={unreadMessages} />;
}
