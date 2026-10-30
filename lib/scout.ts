import { getDb } from '../db';
import { entries } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
export const brief={name:'Jesoamaka Agugo',roles:['Customer Support','Technical Support','Customer Success','Client Onboarding','Implementation','Merchant Success','Client Operations'],geography:'Remote; Nigeria explicitly eligible, Africa or worldwide. EMEA alone requires confirmation. Do not infer UK, EU or Malta work authorization.',pay:'Prefer at least USD700 or EUR700 monthly; undisclosed salary can qualify. Do not invent currency conversions.',freshness:'Verified posted within 24 hours only in the fresh feed; prioritize last hour. Unknown posting date goes to review, never call newly discovered fresh. Original date required for reposts.',sources:'Direct employer career pages and ATS; recruiter/founder public posts on LinkedIn, X, Reddit, Threads, Bluesky, Instagram and TikTok where accessible. Verify official application URL and open status. Record inaccessible sources.',history:'Read application history and saved statuses before recommending; match employer + role + requisition/URL. Prior company with different role requires review, not automatic rejection.',report:'Every scan must save a report, including zero matches and failures. Never claim exhaustive internet coverage or applicant rank.'};
export async function readState(){const rows=await getDb().select().from(entries).orderBy(desc(entries.created));return {jobs:rows.filter(r=>r.kind==='job').map(r=>JSON.parse(r.payload)),reports:rows.filter(r=>r.kind==='report').slice(0,100).map(r=>JSON.parse(r.payload)),history:rows.filter(r=>r.kind==='history').map(r=>JSON.parse(r.payload)),statuses:Object.fromEntries(rows.filter(r=>r.kind==='status').map(r=>[r.id.replace('status:',''),JSON.parse(r.payload)])),brief};}
export async function writeBatch(data:any){
 if(!data.runId||typeof data.summary!=='string'||!Array.isArray(data.jobs)||!Array.isArray(data.sources))throw Error('runId, summary, jobs[], sources[] required');
 const db=getDb();const existing=await db.select().from(entries).where(eq(entries.id,'report:'+data.runId));if(existing.length)return {duplicate:true};
 const now=new Date().toISOString();const jobs=[];
 for(const j of data.jobs.slice(0,80)){
 if(!j.company||!j.role||!j.url||!j.evidence||!j.eligibility)throw Error('Each job requires company, role, url, evidence and eligibility');
 if(!/^https:\/\//.test(j.url))throw Error('HTTPS job URL required');
 const id=j.url.replace(/[?#].*$/,'').replace(/\/$/,'');
 const prev=await db.select().from(entries).where(eq(entries.id,'job:'+id));
 const firstSeen=prev.length?JSON.parse(prev[0].payload).firstSeen:now;
 const posted=Date.parse(j.postedAt);const hours=(Date.now()-posted)/3600000;
 const fresh=Number.isFinite(posted)&&hours>=0&&hours<=24&&j.openVerified===true&&j.eligibility==='confirmed'&&j.historyCheck==='clear';
 const job={...j,id,firstSeen,lastVerified:now,fresh};
 jobs.push(db.insert(entries).values({id:'job:'+id,kind:'job',payload:JSON.stringify(job),created:now}).onConflictDoUpdate({target:entries.id,set:{payload:JSON.stringify(job)}}));
 }
 for(const h of (data.history||[]).slice(0,300))jobs.push(db.insert(entries).values({id:'history:'+h.company.toLowerCase()+':'+h.role.toLowerCase(),kind:'history',payload:JSON.stringify(h),created:now}).onConflictDoNothing());
 const report={id:data.runId,at:now,summary:data.summary,sources:data.sources,found:data.jobs.length,notes:data.notes||'',type:data.type||'scan'};
 jobs.push(db.insert(entries).values({id:'report:'+data.runId,kind:'report',payload:JSON.stringify(report),created:now}));
 await db.batch(jobs as any);return report;
}
