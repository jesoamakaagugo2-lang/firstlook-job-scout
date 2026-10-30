import {readState} from '../lib/scout';
import {isFresh} from '../lib/policy.mjs';
const origin='https://firstlook-job-scout.jesoamakaagugo2.workers.dev';
const statement=(env:any,id:string,payload:any)=>env.DB.prepare('INSERT INTO entries (id,kind,payload,created) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(id,'notification',JSON.stringify(payload),payload.at);
export async function notifyPending(env:any,now=new Date()){
 if(!env.RESEND_API_KEY||!env.EMAIL_FROM)return {configured:false};
 const state=await readState();
 const day=new Date(now.getTime()+3600000).toISOString().slice(0,10);
 // Daily digest at 20:00 WAT, retryable for the rest of the local day.
 if(now.getUTCHours()>=19&&now.getUTCHours()<23){
  const id='notification:digest:'+day;
  const reports=state.reports.filter((r:any)=>new Date(Date.parse(r.at)+3600000).toISOString().slice(0,10)===day);
  const payload={status:'pending',at:now.toISOString(),kind:'digest',jobs:state.jobs.filter((j:any)=>isFresh(j)),summary:reports.length+' scan reports today; '+state.jobs.filter((j:any)=>isFresh(j)).length+' currently fresh matches. '+state.followUps.length+' follow-ups need review.'};
  await env.DB.prepare('INSERT INTO entries (id,kind,payload,created) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').bind(id,'notification',JSON.stringify(payload),payload.at).run();
 }
 const {results}=await env.DB.prepare("SELECT id,payload FROM entries WHERE kind='notification'").all();
 for(const row of results){
  const item=JSON.parse(row.payload);if(item.status==='sent'||item.status==='expired'||(item.leaseUntil&&Date.parse(item.leaseUntil)>+now))continue;
  // Stop retrying before Resend's 24-hour idempotency retention expires.
  if(now.getTime()-Date.parse(item.at)>23*3600000){await statement(env,row.id,{...item,status:'expired',error:'Delivery window expired; review provider delivery logs'}).run();continue;}
  if(item.nextAttemptAt&&Date.parse(item.nextAttemptAt)>+now)continue;
  const jobs=(item.jobs||[]).filter((j:any)=>isFresh(j)&&!['applied','rejected','dismissed'].includes(state.statuses[j.id]?.status));
  if(item.kind==='fresh'&&!jobs.length){await statement(env,row.id,{...item,status:'expired',error:'No qualifying fresh jobs remain'}).run();continue;}
  const text=[item.summary||jobs.length+' new fresh matches',...jobs.map((j:any)=>[j.company+' — '+j.role,j.location,j.salary||'Salary undisclosed','Posted: '+j.postedAt,'Eligibility: '+j.eligibility+'; history: '+j.historyCheck,j.url].join('\n')),item.kind==='digest'?'Follow-up reminders are suggestions; check recent correspondence before contacting anyone.':'',origin].filter(Boolean).join('\n\n');
  // Stable request body + key make cron/report retries idempotent.
  const body=item.deliveryBody||{from:env.EMAIL_FROM,to:[env.OWNER_EMAIL],subject:item.kind==='digest'?'Firstlook daily digest — '+day:'Firstlook — '+jobs.length+' fresh match'+(jobs.length===1?'':'es'),text};
  const claim={...item,deliveryBody:body,status:'pending',leaseUntil:new Date(+now+300000).toISOString()};
  const lock=await env.DB.prepare('UPDATE entries SET payload=? WHERE id=? AND payload=?').bind(JSON.stringify(claim),row.id,row.payload).run();if(!lock.meta.changes)continue;
  try{
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':row.id},body:JSON.stringify(body)});
   if(!response.ok)throw Error('Email provider returned HTTP '+response.status);
   const result:any=await response.json();
   await statement(env,row.id,{...item,deliveryBody:body,status:'sent',sentAt:now.toISOString(),providerId:result.id}).run();
  }catch(e){await statement(env,row.id,{...item,deliveryBody:body,status:'failed',error:e instanceof Error?e.message:'Email failed',nextAttemptAt:new Date(+now+3600000).toISOString()}).run();}
 }
 return {configured:true};
}
export async function backupSnapshot(env:any){
 if(!env.BACKUPS)return {configured:false};
 const snapshot=await env.DB.prepare('SELECT id,kind,payload,created FROM entries ORDER BY id').all();
 const key='firstlook/'+new Date().toISOString().slice(0,10)+'.json';
 await env.BACKUPS.put(key,JSON.stringify({at:new Date().toISOString(),entries:snapshot.results}),{httpMetadata:{contentType:'application/json'}});
 return {key};
}
