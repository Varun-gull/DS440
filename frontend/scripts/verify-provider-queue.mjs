import assert from 'node:assert/strict';
import { providerRetryDelay, queuedProviderRequest } from '../lib/assistant/provider-retry.ts';
let passed=0;
async function check(label,fn){await fn();passed++;console.log('PASS '+label);}
const quota=(quotaId,retryDelay)=>({status:429,message:JSON.stringify({error:{details:[{violations:[{quotaId}]},{retryDelay}]}})});
await check('transient quotas honor a bounded provider retry delay',()=>assert.equal(providerRetryDelay(quota('RequestsPerMinute','12.5s')),12500));
await check('daily quota exhaustion is never retried',()=>assert.equal(providerRetryDelay(quota('RequestsPerDayPerProject','10s')),null));
await check('long cooldowns do not hold requests past the function deadline',()=>assert.equal(providerRetryDelay(quota('RequestsPerMinute','62876s')),null));
await check('invalid keys and other non quota errors are not retried',()=>{for(const status of [400,401,403,404,500])assert.equal(providerRetryDelay({status}),null);});
await check('unstructured quota errors use a short safe fallback',()=>assert.equal(providerRetryDelay({status:429,message:'private provider context'}),5000));
function fixture(errors=[],slotWait=0){let clock=0,calls=0,slots=0,checks=0;const sleeps=[];return{get counts(){return{calls,slots,checks,sleeps};},options:{reserveSlot:async budget=>{assert.ok(slotWait<=budget);slots++;clock+=slotWait;},validateSession:async()=>{checks++;},request:async()=>{const error=errors[calls++];if(error)throw error;return 'reply';},sleep:async ms=>{clock+=ms;sleeps.push(ms);},now:()=>clock,jitter:()=>0.5,requestTimeoutMs:35000}};}
await check('a throttled request reenters the shared queue and rechecks its session',async()=>{const f=fixture([{status:429}]);assert.equal(await queuedProviderRequest(f.options),'reply');assert.deepEqual({...f.counts,sleeps:undefined},{calls:2,slots:2,checks:2,sleeps:undefined});assert.equal(f.counts.sleeps.length,1);assert.ok(f.counts.sleeps[0]>=5000);});
await check('repeated throttling stops after one retry',async()=>{const f=fixture([{status:429},{status:429}]);await assert.rejects(()=>queuedProviderRequest(f.options));assert.equal(f.counts.calls,2);});
await check('a daily quota failure consumes only one provider attempt',async()=>{const f=fixture([quota('RequestsPerDay','1s')]);await assert.rejects(()=>queuedProviderRequest(f.options));assert.equal(f.counts.calls,1);assert.equal(f.counts.sleeps.length,0);});
await check('revoked sessions cannot send a retry to Google',async()=>{const f=fixture([{status:429}]);let checks=0;f.options.validateSession=async()=>{if(++checks===2)throw new Error('revoked');};await assert.rejects(()=>queuedProviderRequest(f.options),/revoked/);assert.equal(f.counts.calls,1);});
await check('insufficient retry time returns without another provider call',async()=>{const f=fixture([quota('RequestsPerMinute','60s')],126000);await assert.rejects(()=>queuedProviderRequest(f.options));assert.equal(f.counts.calls,1);assert.equal(f.counts.sleeps.length,0);});
console.log(`${passed} provider queue checks passed. Simulated failures and clocks only.`);
