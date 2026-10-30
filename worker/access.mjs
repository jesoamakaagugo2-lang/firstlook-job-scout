// Access data must be cryptographically verified before it can authorize data access.
const jwksCache = new Map();
const decode = s => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')), c=>c.charCodeAt(0));
export async function authorize(request, env, ctx) {
  const owner = env.OWNER_EMAIL?.toLowerCase();
  if (!owner) return {status:503, message:'Owner configuration is missing.'};
  // Platform-verified identity is available for direct Worker invocations.
  if (ctx.access) {
    const identity=await ctx.access.getIdentity();
    return identity?.email?.toLowerCase()===owner ? null : {status:403,message:'This workspace is private.'};
  }
  // Workers with Static Assets may not receive ctx.access. Validate the Access JWT.
  const team = env.TEAM_DOMAIN?.replace(/\/$/,'');
  const aud = env.POLICY_AUD;
  if (!team || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(team) || !aud) {
    return {status:503,message:'Private access setup required: configure TEAM_DOMAIN and POLICY_AUD in Worker settings. No workspace data is available until setup is complete.'};
  }
  const jwt=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!jwt)return {status:403,message:'Sign in through Cloudflare Access to open this workspace.'};
  try {
    const pieces=jwt.split('.');if(pieces.length!==3)throw Error('Malformed token');
    const header=JSON.parse(new TextDecoder().decode(decode(pieces[0])));
    const claims=JSON.parse(new TextDecoder().decode(decode(pieces[1])));
    const now=Date.now()/1000;
    if(header.alg!=='RS256'||claims.iss!==team||!Array.isArray(claims.aud)||!claims.aud.includes(aud)||!Number.isFinite(claims.exp)||claims.exp<=now||(claims.nbf&&claims.nbf>now))throw Error('Invalid claims');
    let cached=jwksCache.get(team);
    if(!cached||cached.until<Date.now()||!cached.keys.some(k=>k.kid===header.kid)){
      const response=await fetch(team+'/cdn-cgi/access/certs');if(!response.ok)throw Error('No keys');
      const body=await response.json();if(!Array.isArray(body.keys))throw Error('No keys');
      cached={keys:body.keys,until:Date.now()+300000};jwksCache.set(team,cached);
    }
    const jwk=cached.keys.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)throw Error('Unknown key');
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(pieces[2]),new TextEncoder().encode(pieces[0]+'.'+pieces[1]));
    if(!ok||claims.email?.toLowerCase()!==owner)throw Error('Not authorized');
    return null;
  }catch{return {status:403,message:'Private access could not be verified. Sign in again.'};}
}
