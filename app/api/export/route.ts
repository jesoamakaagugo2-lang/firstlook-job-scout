import {readState} from '../../../lib/scout';
const cell=(v:any)=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
export async function GET(req:Request){
 const state=await readState();const history=new URL(req.url).searchParams.get('kind')==='history';
 const rows=history?state.history:state.jobs;const fields=history?['company','role','date','status','url','salary','location','contact','nextAction']:['company','role','url','postedAt','eligibility','historyCheck','location','salary','fresh'];
 const csv=[fields.join(','),...rows.map((r:any)=>fields.map(f=>cell(r[f])).join(','))].join('\r\n');
 return new Response('\uFEFF'+csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="firstlook-'+(history?'history':'jobs')+'.csv"','Cache-Control':'private, no-store'}});
}
