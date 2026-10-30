import worker from './index';
import {authorize} from './access.mjs';
import {reportAuthorization} from './report-auth.mjs';
import {notifyPending,backupSnapshot} from './scheduled';
export default {
  async fetch(request:Request, env:any, ctx:any) {
    const machine=new URL(request.url).pathname==='/api/report';
    const denied=machine?await reportAuthorization(request,env):await authorize(request,env,ctx);
    if(denied)return new Response(denied.message,{status:denied.status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
    const origin=request.headers.get('Origin');
    if(!['GET','HEAD','OPTIONS'].includes(request.method)&&origin&&origin!==new URL(request.url).origin)return new Response('Origin not allowed',{status:403});
    const response=await worker.fetch(request,env,ctx);
    const headers=new Headers(response.headers);headers.set('Cache-Control','private, no-store');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  },
  async scheduled(event:any,env:any,ctx:any){
    // This trigger sends mail and backs up data; job discovery stays in the scout.
    ctx.waitUntil(notifyPending(env));
    if(event.cron==='15 2 * * 0')ctx.waitUntil(backupSnapshot(env));
  }
};
