import {env} from 'cloudflare:workers';
import {reportAuthorization} from '../../../worker/report-auth.mjs';
import {readState,writeBatch} from '../../../lib/scout';
import {notifyPending} from '../../../worker/scheduled';
export const dynamic='force-dynamic';
async function denied(req:Request){const result=await reportAuthorization(req,env);return result?Response.json({error:result.message},{status:result.status,headers:{'Cache-Control':'no-store'}}):null;}
export async function GET(req:Request){const error=await denied(req);if(error)return error;if(new URL(req.url).searchParams.get('backup')==='1'){const rows=await (env as any).DB.prepare('SELECT id,kind,payload,created FROM entries ORDER BY id').all();return Response.json({at:new Date().toISOString(),entries:rows.results},{headers:{'Cache-Control':'no-store'}});}return Response.json(await readState(),{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:Request){
 const error=await denied(req);if(error)return error;
 try{
  if(Number(req.headers.get('Content-Length')||0)>1000000)return Response.json({error:'Report too large'},{status:413});
  const text=await req.text();if(text.length>1000000)return Response.json({error:'Report too large'},{status:413});
  const result=await writeBatch(JSON.parse(text));
  // Delivery failures never roll back the stored scan. Cron retries pending mail.
  try{await notifyPending(env)}catch{}
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Invalid report'},{status:400});}
}
