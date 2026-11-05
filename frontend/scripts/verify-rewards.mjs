import assert from "node:assert/strict";
import { storeRewards, isOwned, canRefund, pointsToGo } from "../lib/rewards/store.ts";
import { parseRewardArtifact, artifactText } from "../lib/rewards/artifacts.ts";
import { isProtectedStreakGap } from "../lib/streak.ts";
let passed=0;function check(label,fn){fn();passed++;console.log(`PASS ${label}`);}
check("all ten selected reward ideas have unique catalog entries",()=>{assert.equal(storeRewards.length,10);assert.equal(new Set(storeRewards.map(r=>r.id)).size,10);});
check("workshops cannot be redeemed before a real event exists",()=>{const reward=storeRewards.find(r=>r.kind==='workshop');assert.equal(reward.available,false);assert.equal(reward.cost,0);});
check("returned rewards do not stay permanently unlocked",()=>assert.equal(isOwned({redemptions:[{reward_id:'career-insights',status:'refunded'}]},'career-insights'),false));
check("points needed never become negative",()=>assert.equal(pointsToGo(25,40),0));
check("only recent unused paid rewards can be returned",()=>{const now=Date.now(),r={cost:25,status:'available',created_at:new Date(now-1000).toISOString()};assert.equal(canRefund(r,now),true);assert.equal(canRefund({...r,status:'used'},now),false);assert.equal(canRefund({...r,cost:0},now),false);assert.equal(canRefund({...r,created_at:new Date(now-8*86400000).toISOString()},now),false);});
check("a planned break preserves the gap across a month boundary",()=>assert.equal(isProtectedStreakGap('2026-10-31','2026-11-02',['2026-11-01']),true));
check("unprotected missed days still break a streak",()=>assert.equal(isProtectedStreakGap('2026-10-31','2026-11-03',['2026-11-01']),false));
check("future protection cannot repair an old gap",()=>assert.equal(isProtectedStreakGap('2026-10-31','2026-11-02',['2026-11-02']),false));
check("two scheduled days preserve a three day gap",()=>assert.equal(isProtectedStreakGap('2026-11-01','2026-11-04',['2026-11-02','2026-11-03']),true));
check("a new account does not gain a streak by buying protection",()=>assert.equal(isProtectedStreakGap(null,'2026-11-04',['2026-11-03']),false));
const report={title:'Interview preparation',summary:'A synthetic report.',sections:[{title:'Questions',items:['Explain a project.']},{title:'Next steps',items:['Prepare truthful examples.']}]};
check("reports export with readable numbered sections",()=>{const text=artifactText(parseRewardArtifact(report));assert.match(text,/1\. Explain a project/);assert.match(text,/CareerUp AI guidance/);});
check("truncated or oversized AI output is rejected before saving",()=>{assert.throws(()=>parseRewardArtifact({title:'Incomplete'}));assert.throws(()=>parseRewardArtifact({...report,sections:[...report.sections,{title:'Bad',items:['x'.repeat(2001)]}]}));});
console.log(`${passed} reward behavior checks passed.`);
