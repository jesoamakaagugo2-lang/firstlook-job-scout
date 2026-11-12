import { isFresh } from './freshness.mjs';
import { validateSettings } from './settings.mjs';
import { getDb } from '../db';
import { entries } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
export const brief={name:'Jesoamaka Agugo',roles:['Customer Support','Technical Support','Customer Success','Client Onboarding','Implementation','Merchant Success','Client Operations'],geography:'Remote; Nigeria explicitly eligible, Africa or worldwide. EMEA alone requires confirmation. Do not infer UK, EU or Malta work authorization.',postingWindowDays:21,payFloor:700,pay:'Prefer at least USD700 or EUR700 monthly; undisclosed salary can qualify. Do not invent currency conversions.',freshness:'Verified original postings within the past 21 days (504 hours) in the fresh feed; search the full window, newest first. Unknown posting date goes to review, never call newly discovered fresh. Original date required for reposts.',sources:'Direct employer career pages and ATS; recruiter/founder public posts on LinkedIn, X, Reddit, Threads, Bluesky, Instagram and TikTok where accessible. Verify official application URL and open status. Record inaccessible sources.',history:'Read application history and saved statuses before recommending; match employer + role + requisition/URL. Prior company with different role requires review, not automatic rejection.',report:'Every scan must save a report, including zero matches and failures. Never claim exhaustive internet coverage or applicant rank.'};
export async function readState(){const rows=await getDb().select().from(entries).orderBy(desc(entries.created));const settings={...brief,...JSON.parse(rows.find(r=>r.id==='settings:brief')?.payload||'{}')};settings.freshness=`Verified original postings within the past ${settings.postingWindowDays} days, newest first. Unknown posting dates go to review.`;return {scanIntervalMinutes:180,jobs:rows.filter(r=>r.kind==='job').map(r=>{const job=JSON.parse(r.payload);return {...job,fresh:isFresh(job,Date.now(),settings.postingWindowDays)}}),reports:rows.filter(r=>r.kind==='report').slice(0,100).map(r=>JSON.parse(r.payload)),history:rows.filter(r=>r.kind==='history').map(r=>JSON.parse(r.payload)),statuses:Object.fromEntries(rows.filter(r=>r.kind==='status').map(r=>[r.id.replace('status:',''),JSON.parse(r.payload)])),brief:settings};}
export async function writeBatch(data:any){
 if(!data.runId||typeof data.summary!=='string'||!Array.isArray(data.jobs)||!Array.isArray(data.sources))throw Error('runId, summary, jobs[], sources[] required');
 const db=getDb();const existing=await db.select().from(entries).where(eq(entries.id,'report:'+data.runId));if(existing.length)return {duplicate:true};
 const state=await readState();const now=new Date().toISOString();const jobs=[];
 for(const j of data.jobs.slice(0,80)){
 if(!j.company||!j.role||!j.url||!j.evidence||!j.eligibility)throw Error('Each job requires company, role, url, evidence and eligibility');
 if(!/^https:\/\//.test(j.url))throw Error('HTTPS job URL required');
 const id=j.url.replace(/[?#].*$/,'').replace(/\/$/,'');
 const prev=await db.select().from(entries).where(eq(entries.id,'job:'+id));
 const firstSeen=prev.length?JSON.parse(prev[0].payload).firstSeen:now;
 const fresh=isFresh(j,Date.now(),state.brief.postingWindowDays);
 const job={...j,id,firstSeen,lastVerified:now,fresh};
 jobs.push(db.insert(entries).values({id:'job:'+id,kind:'job',payload:JSON.stringify(job),created:now}).onConflictDoUpdate({target:entries.id,set:{payload:JSON.stringify(job)}}));
 }
 for(const h of (data.history||[]).slice(0,300))jobs.push(db.insert(entries).values({id:'history:'+h.company.toLowerCase()+':'+h.role.toLowerCase(),kind:'history',payload:JSON.stringify(h),created:now}).onConflictDoNothing());
 const report={id:data.runId,at:now,summary:data.summary,sources:data.sources,found:data.jobs.length,notes:data.notes||'',type:data.type||'scan'};
 jobs.push(db.insert(entries).values({id:'report:'+data.runId,kind:'report',payload:JSON.stringify(report),created:now}));
 await db.batch(jobs as any);return report;
}

export async function saveSettings(value:any){
 const settings=validateSettings(value);
 const payload=JSON.stringify(settings);
 await getDb().insert(entries).values({id:'settings:brief',kind:'settings',payload,created:new Date().toISOString()}).onConflictDoUpdate({target:entries.id,set:{payload}});
 return {ok:true};
}
