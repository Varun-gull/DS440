import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { assistantJson, checkAssistantOrigin } from "@/lib/assistant/http";
import { assistantConfig, assistantUser, AssistantError } from "@/lib/assistant/server";
import { rewardById } from "@/lib/rewards/store";
import { generateReward, rewardRpc, rewardState, rewardsAdmin } from "@/lib/rewards/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function identifier(body: Record<string, unknown>, key: string) { if (!uuid(body[key])) throw new AssistantError("Refresh and choose a valid reward or invitation."); return body[key] as string; }
function string(body: Record<string, unknown>, key: string, min: number, max: number) { const value = body[key]; if (typeof value !== "string" || value.trim().length < min || value.length > max) throw new AssistantError(`Check the ${key} field and try again.`); return value.trim(); }
function integer(body: Record<string, unknown>, key: string, min: number, max: number) { const value = body[key]; if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new AssistantError(`Choose a valid ${key} value.`); return value; }
function friends(body: Record<string, unknown>) { if (!Array.isArray(body.friends) || body.friends.length < 1 || body.friends.length > 5 || !body.friends.every(uuid)) throw new AssistantError("Choose one to five friends."); return body.friends; }
function failure(error: unknown) { return NextResponse.json({ error: error instanceof AssistantError ? error.message : "Rewards are temporarily unavailable. Please try again." }, { status: error instanceof AssistantError ? error.status : 503, headers }); }
export async function GET(request: Request) {
  try {
    const session = await assistantUser(), id = new URL(request.url).searchParams.get("redemptionId");
    if (id) {
      if (!uuid(id)) throw new AssistantError("Choose a valid saved report.");
      const { data, error } = await rewardsAdmin().from("reward_redemptions").select("id,content").eq("id", id).eq("user_id", session.user.id).in("status", ["ready", "used"]).maybeSingle();
      if (error) throw new AssistantError("This report could not be loaded. Please try again.", 503);
      if (!data?.content) throw new AssistantError("Saved report not found.", 404);
      return NextResponse.json(data, { headers });
    }
    return NextResponse.json(await rewardState(session), { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    checkAssistantOrigin(request);
    const session = await assistantUser(), body = await assistantJson(request), uid = session.user.id;
    switch (body.action) {
      case "redeem": {
        const reward = rewardById(string(body, "rewardId", 1, 80));
        if (!reward || !reward.available || ["pool", "workshop"].includes(reward.kind)) throw new AssistantError("This reward is not available to redeem.");
        if (["voice", "resume", "interview", "skill"].includes(reward.kind) && !assistantConfig().configured) throw new AssistantError("AI rewards will be available when Gemini is connected. No points were charged.", 503);
        if (reward.kind === "voice" && !assistantConfig().voiceEnabled) throw new AssistantError("Live interview practice is currently disabled. No points were charged.", 503);
        await rewardRpc("redeem_careerup_reward", { p_user_id: uid, p_reward_id: reward.id, p_request_key: identifier(body, "requestKey") }); break;
      }
      case "refund": await rewardRpc("refund_careerup_reward", { p_user_id: uid, p_redemption_id: identifier(body, "redemptionId") }); break;
      case "generate": await generateReward(session, body, identifier(body, "redemptionId")); break;
      case "completeSkill": await rewardRpc("complete_reward_skill", { p_user_id: uid, p_redemption_id: identifier(body, "redemptionId"), p_reflection: string(body, "reflection", 80, 2000) }); break;
      case "appearance": await rewardRpc("set_reward_appearance", { p_user_id: uid, p_theme: string(body, "theme", 1, 20), p_avatar: string(body, "avatar", 1, 20), p_badge: string(body, "badge", 0, 30) }); break;
      case "protect": { const day = string(body, "day", 10, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new AssistantError("Choose a date for your day off."); await rewardRpc("activate_streak_day", { p_user_id: uid, p_redemption_id: identifier(body, "redemptionId"), p_day: day }); break; }
      case "createGoal": await rewardRpc("create_reward_goal", { p_user_id: uid, p_title: string(body, "title", 3, 80), p_metric: string(body, "metric", 1, 20), p_target: integer(body, "target", 1, 20), p_days: integer(body, "days", 7, 14), p_friends: friends(body), p_redemption_id: identifier(body, "redemptionId") }); break;
      case "respondGoal": if (typeof body.accept !== "boolean") throw new AssistantError("Choose join or decline."); await rewardRpc("respond_reward_goal", { p_user_id: uid, p_goal_id: identifier(body, "goalId"), p_accept: body.accept }); break;
      case "leaveGoal": await rewardRpc("leave_reward_goal", { p_user_id: uid, p_goal_id: identifier(body, "goalId") }); break;
      case "createPool": await rewardRpc("create_reward_pool", { p_user_id: uid, p_title: string(body, "title", 3, 80), p_friends: friends(body) }); break;
      case "respondPool": if (typeof body.accept !== "boolean") throw new AssistantError("Choose join or decline."); await rewardRpc("respond_reward_pool", { p_user_id: uid, p_pool_id: identifier(body, "poolId"), p_accept: body.accept }); break;
      case "contribute": await rewardRpc("contribute_reward_pool", { p_user_id: uid, p_pool_id: identifier(body, "poolId"), p_points: integer(body, "points", 1, 120), p_request_key: identifier(body, "requestKey") }); break;
      case "cancelPool": await rewardRpc("cancel_reward_pool", { p_user_id: uid, p_pool_id: identifier(body, "poolId") }); break;
      default: throw new AssistantError("Choose an available rewards action.");
    }
    revalidatePath("/rewards"); revalidatePath("/dashboard"); revalidatePath("/profile"); revalidatePath("/interview/assistant");
    return NextResponse.json(await rewardState(session), { headers });
  } catch (error) { return failure(error); }
}
