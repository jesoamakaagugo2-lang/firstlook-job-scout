export const normalize = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\bsr\b/g,'senior').replace(/\bjr\b/g,'junior').replace(/[^a-z0-9]+/g,' ').trim();
export const companyKey = s => normalize(s).replace(/\b(incorporated|inc|limited|ltd|llc|plc)\b/g,'').replace(/\s+/g,' ').trim();
export function cleanUrl(value) {
 const u=new URL(value);if(u.protocol!=='https:')throw Error('Official application URL must use HTTPS');
 u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_.+|ref|referrer|source|tracking|gh_src|lever-source|from)$/i.test(k))u.searchParams.delete(k);
 u.searchParams.sort();u.hostname=u.hostname.toLowerCase();u.pathname=u.pathname.replace(/\/$/,'')||'/';return u.toString().replace(/\/$/,'');
}
export function similarity(a,b) {
 const x=new Set(normalize(a).split(' ').filter(Boolean)),y=new Set(normalize(b).split(' ').filter(Boolean));
 const union=new Set([...x,...y]);return union.size?[...x].filter(t=>y.has(t)).length/union.size:0;
}
export const jobKey = j => companyKey(j.company)+'|'+normalize(j.role);
export function hasTimestamp(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s)&&Number.isFinite(Date.parse(s));}
export function isFresh(j,now=Date.now()) {
 const age=now-Date.parse(j.postedAt);
 return hasTimestamp(j.postedAt)&&age>=0&&age<=86400000&&j.openVerified===true&&j.eligibility==='confirmed'&&j.historyCheck==='clear'&&!j.talentPool&&!j.closed;
}
function historyStatus(s){
 if(/delivery failed|prepared|draft|submission not found|application\s*\/\s*rejection not found|saved\/incomplete/i.test(s))return 'unconfirmed';
 if(/rejected/i.test(s))return 'prior rejection';
 if(/\bapplied\b|application submitted/i.test(s))return 'prior application';
 return 'unconfirmed';
}
export function checkHistory(job,history,statuses={},jobs=[]) {
 const key=companyKey(job.company),title=normalize(job.role),url=cleanUrl(job.url);let uncertain=false;
 for(const previous of jobs){
  const status=statuses[previous.id]?.status;
  if(!['applied','rejected'].includes(status))continue;
  if(cleanUrl(previous.url)===url||jobKey(previous)===jobKey(job))return {status:status==='rejected'?'prior rejection':'prior application',reason:'Recorded dashboard status for matching URL or employer and role'};
 }
 for(const h of history){
  const hkey=companyKey(h.company);const known=hkey&&hkey!=='not found';
  const urls=String(h.url||'').match(/https:\/\/[^\s;]+/g)||[];
  const sameUrl=urls.some(u=>{try{return cleanUrl(u)===url}catch{return false}});
  const sameCompany=known&&(key===hkey||similarity(key,hkey)>=0.8);
  const exactRole=title===normalize(h.role);
  if(sameUrl||(sameCompany&&exactRole)){
   const status=historyStatus(h.status||'');if(status!=='unconfirmed')return {status,reason:'Matched imported application history'};uncertain=true;
  }else if(sameCompany)uncertain=true;
  else if(!known&&similarity(title,h.role)>=0.75)uncertain=true;
 }
 return {status:uncertain?'unconfirmed':'clear',reason:uncertain?'Related employer, similar title or unresolved historical record requires review':'No matching saved history/status found'};
}
export function matchScore(j,settings={},now=Date.now()){
 const roles=settings.roles||['customer support','technical support','customer success','onboarding','implementation','merchant success','client operations'];
 const role=Math.round(30*Math.max(0,...roles.map(r=>normalize(j.role).includes(normalize(r))?1:similarity(j.role,r))));
 const eligibility=j.eligibility==='confirmed'?30:0;
 const monthly=Number(j.salaryMonthly),known=Number.isFinite(monthly)&&monthly>0&&['USD','EUR'].includes(j.salaryCurrency);
 const pay=known?(monthly>=Number(settings.payFloor||700)?20:0):10;
 const age=now-Date.parse(j.postedAt);const freshness=hasTimestamp(j.postedAt)&&age>=0?(age<=3600000?20:age<=86400000?10:0):0;
 return {total:role+eligibility+pay+freshness,role,eligibility,pay,freshness};
}
export function businessDaysSince(date,now=new Date()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return null;
 const start=new Date(date+'T12:00:00Z');if(Number.isNaN(+start)||start.toISOString().slice(0,10)!==date)return null;
 const end=new Date(new Date(now).getTime()+3600000).toISOString().slice(0,10);let days=0;
 for(start.setUTCDate(start.getUTCDate()+1);start.toISOString().slice(0,10)<=end;start.setUTCDate(start.getUTCDate()+1))if(start.getUTCDay()!==0&&start.getUTCDay()!==6)days++;
 return days;
}
export function followUps(history,now=new Date()){
 return history.flatMap(h=>{
  if(!/\bapplied\b/i.test(h.status||'')||/rejected|replied|interview|delivery failed|closed|expired|pool/i.test(h.status||''))return [];
  const date=/^(\d{4}-\d{2}-\d{2})(?:$| WAT$| receipt$)/.exec(h.date||'')?.[1];const days=businessDaysSince(date,now);
  return days!==null&&days>=5?[{...h,businessDays:days,followUpState:days<=7?'Due now':'Overdue — check recent correspondence first'}]:[];
 }).sort((a,b)=>a.businessDays-b.businessDays);
}
