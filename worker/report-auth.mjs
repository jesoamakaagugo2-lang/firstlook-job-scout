// This credential authorizes only the exact report endpoint, never owner pages.
export async function reportAuthorization(request,env){
 const path=new URL(request.url).pathname;
 if(path!=='/api/report')return {status:403,message:'Report credential is not valid for this path.'};
 if(!['GET','POST'].includes(request.method))return {status:405,message:'Use GET or POST.'};
 if(!env.SCOUT_REPORT_TOKEN||env.SCOUT_REPORT_TOKEN.length<32)return {status:503,message:'The scout writer is not configured.'};
 const value=request.headers.get('Authorization')||'';
 if(!value.startsWith('Bearer ')||value.length>1024)return {status:401,message:'Report authorization required.'};
 const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const a=await hash(value.slice(7)),b=await hash(env.SCOUT_REPORT_TOKEN);let diff=0;
 for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 return diff?{status:401,message:'Report authorization failed.'}:null;
}
