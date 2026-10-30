import {env} from 'cloudflare:workers';
import {getDb} from '../db';
import {entries} from '../db/schema';
import {eq,desc} from 'drizzle-orm';
import {cleanUrl,jobKey,checkHistory,hasTimestamp,isFresh,matchScore,followUps} from './policy.mjs';
export const brief={name:'Jesoamaka Agugo',roles:['Customer Support','Technical Support','Customer Success','Client Onboarding','Implementation','Merchant Success','Client Operations'],geography:'Remote; Nigeria explicitly eligible, Africa or worldwide. EMEA alone requires confirmation. Do not infer UK, EU or Malta work authorization.',pay:'Prefer at least USD700 or EUR700 monthly; undisclosed salary can qualify. Do not invent currency conversions.',payFloor:700,freshness:'Verified posted within 24 hours only in the fresh feed; prioritize last hour. Unknown posting date goes to review, never call newly discovered fresh. Original date required for reposts.',sources:'Direct employer career pages and ATS; recruiter/founder public posts on LinkedIn, X, Reddit, Threads, Bluesky, Instagram and TikTok where accessible. Verify official application URL and open status. Record inaccessible sources.',history:'Read application history and saved statuses before recommending; match employer + role + requisition/URL. Prior company with different role requires review, not automatic rejection.',report:'Every scan must save a report, including zero matches and failures. Never claim exhaustive internet coverage or applicant rank.'};
export async function readState(){
 const rows=await getDb().select().from(entries).orderBy(desc(entries.created));
 const settings={...brief,...JSON.parse(rows.find(r=>r.id==='settings:brief')?.payload||'{}')};
 const statuses=Object.fromEntries(rows.filter(r=>r.kind==='status').map(r=>[r.id.replace('status:',''),JSON.parse(r.payload)]));
 const history=rows.filter(r=>r.kind==='history').map(r=>JSON.parse(r.payload));
 const jobs=rows.filter(r=>r.kind==='job').map(r=>JSON.parse(r.payload)).map(j=>{
  const h=checkHistory(j,history,statuses,rows.filter(r=>r.kind==='job').map(r=>JSON.parse(r.payload)));
  // Re-evaluate against current history/statuses, including migrated records.
  const historyCheck=h.status==='clear'?j.historyCheck:h.status;
  const updated={...j,historyCheck};return {...updated,fresh:isFresh(updated)&&!['applied','rejected','dismissed'].includes(statuses[j.id]?.status),score:matchScore(updated,settings)};
 }).sort((a,b)=>b.score.total-a.score.total);
 return {system:{reportWriterConfigured:!!(env as any).SCOUT_REPORT_TOKEN,emailConfigured:!!((env as any).RESEND_API_KEY&&(env as any).EMAIL_FROM),backupConfigured:!!(env as any).BACKUPS},jobs,reports:rows.filter(r=>r.kind==='report').map(r=>JSON.parse(r.payload)),history,statuses,brief:settings,followUps:followUps(history),notifications:rows.filter(r=>r.kind==='notification').map(r=>{const p=JSON.parse(r.payload);return {id:r.id,status:p.status,at:p.at,error:p.error}}),migration:JSON.parse(rows.find(r=>r.id==='migration:october-2026')?.payload||'null')};
}
export async function saveSettings(value:any){
 const allowed=['roles','geography','pay','payFloor'];if(Object.keys(value).some(k=>!allowed.includes(k)))throw Error('Only roles, geography, pay and payFloor can be edited');
 if(!Array.isArray(value.roles)||!value.roles.length||value.roles.length>20||value.roles.some((r:any)=>typeof r!=='string'||!r.trim()||r.length>150))throw Error('Enter 1–20 role names');
 if(!Number.isFinite(value.payFloor)||value.payFloor<0||value.payFloor>100000)throw Error('Enter a valid monthly pay floor');
 if(typeof value.geography!=='string'||!value.geography.trim()||value.geography.length>3000||typeof value.pay!=='string'||value.pay.length>3000)throw Error('Enter valid geography and pay notes');
 await getDb().insert(entries).values({id:'settings:brief',kind:'settings',payload:JSON.stringify(value),created:new Date().toISOString()}).onConflictDoUpdate({target:entries.id,set:{payload:JSON.stringify(value)}});
 return {ok:true};
}
export async function writeBatch(data:any){
 if(typeof data.runId!=='string'||!/^[-a-zA-Z0-9T:._]+$/.test(data.runId)||data.runId.length>150||typeof data.summary!=='string'||!Array.isArray(data.jobs)||data.jobs.length>80||!Array.isArray(data.sources))throw Error('runId, summary, jobs[0..80], sources[] required');
 if(data.history)throw Error('History imports use the audited migration, not the report writer');
 const db=getDb();const existing=await db.select().from(entries).where(eq(entries.id,'report:'+data.runId));if(existing.length)return {...JSON.parse(existing[0].payload),duplicate:true};
 const state=await readState();const now=new Date().toISOString();const writes:any[]=[];const batchJobs:any[]=[];const freshNew:any[]=[];
 for(const input of data.jobs){
  if(typeof input.company!=='string'||typeof input.role!=='string'||!input.company.trim()||!input.role.trim()||!input.evidence||!['confirmed','unconfirmed','ineligible'].includes(input.eligibility)||!['clear','prior application','prior rejection','unconfirmed'].includes(input.historyCheck))throw Error('Each job needs company, role, evidence, eligibility and historyCheck');
  if(input.postedAt!==null&&!hasTimestamp(input.postedAt))throw Error('postedAt must be a verified ISO timestamp with timezone, or null; date-only values are not accepted');
  const url=cleanUrl(input.url);const all=[...state.jobs,...batchJobs];
  // Employer + title deduplicates reposts across URLs; requisition differences remain in evidence.
  const previous=all.find(j=>cleanUrl(j.url)===url||jobKey(j)===jobKey(input));
  const id=previous?.id||url;const hist=checkHistory({...input,url},state.history,state.statuses,all);
  const historyCheck=hist.status==='clear'?input.historyCheck:hist.status;
  // Reposting an old known role cannot reset the first original posting timestamp.
  const postedAt=previous?.postedAt&&hasTimestamp(previous.postedAt)?(input.postedAt?new Date(Math.min(Date.parse(previous.postedAt),Date.parse(input.postedAt))).toISOString():previous.postedAt):input.postedAt;
  const j={...input,url,id,postedAt,historyCheck,historyEvidence:hist.reason,firstSeen:previous?.firstSeen||now,lastVerified:now};
  const job={...j,fresh:isFresh(j)&&!['applied','rejected','dismissed'].includes(state.statuses[id]?.status),score:matchScore(j,state.brief)};
  if(job.fresh&&!previous?.firstFreshAt){(job as any).firstFreshAt=now;freshNew.push(job);}else if(previous?.firstFreshAt){(job as any).firstFreshAt=previous.firstFreshAt;}
  const duplicateIndex=batchJobs.findIndex(j=>j.id===job.id);if(duplicateIndex>=0)batchJobs[duplicateIndex]=job;else batchJobs.push(job);
  writes.push(db.insert(entries).values({id:'job:'+id,kind:'job',payload:JSON.stringify(job),created:now}).onConflictDoUpdate({target:entries.id,set:{payload:JSON.stringify(job)}}));
 }
 const freshCount=batchJobs.filter(j=>j.fresh).length;
 const report={id:data.runId,at:now,summary:data.summary,sources:data.sources,found:batchJobs.length,freshCount,newFreshCount:freshNew.length,notes:data.notes||'',type:'scan'};
 writes.push(db.insert(entries).values({id:'report:'+data.runId,kind:'report',payload:JSON.stringify(report),created:now}));
 if(freshNew.length){
  const hour=now.slice(0,13);const notification={status:'pending',at:now,kind:'fresh',jobs:freshNew,reportId:data.runId};
  writes.push(db.insert(entries).values({id:'notification:fresh:'+hour,kind:'notification',payload:JSON.stringify(notification),created:now}).onConflictDoNothing());
 }
 try{await db.batch(writes as any)}catch(error){
  const raced=await db.select().from(entries).where(eq(entries.id,'report:'+data.runId));if(raced.length)return {...JSON.parse(raced[0].payload),duplicate:true};throw error;
 }
 return report;
}
