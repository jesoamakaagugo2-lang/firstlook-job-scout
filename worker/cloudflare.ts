import worker from './index';
import {authorize} from './access.mjs';
export default {
  async fetch(request:Request, env:any, ctx:any) {
    const denied=await authorize(request,env,ctx);
    if(denied)return new Response(denied.message,{status:denied.status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
    const origin=request.headers.get('Origin');
    if(!['GET','HEAD','OPTIONS'].includes(request.method)&&origin&&origin!==new URL(request.url).origin)return new Response('Origin not allowed',{status:403});
    const response=await worker.fetch(request,env,ctx);
    const headers=new Headers(response.headers);headers.set('Cache-Control','private, no-store');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};
