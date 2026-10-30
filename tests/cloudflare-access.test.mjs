import test from 'node:test';
import assert from 'node:assert/strict';
import {authorize} from '../worker/access.mjs';
const owner='jesoamakaagugo2@gmail.com';
const env={OWNER_EMAIL:owner,TEAM_DOMAIN:'https://firstlook-test.cloudflareaccess.com',POLICY_AUD:'test-audience'};
const request=jwt=>new Request('https://firstlook.example/api/scout',{headers:jwt?{'Cf-Access-Jwt-Assertion':jwt}:{}});
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test-key'};
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{assert.equal(url,env.TEAM_DOMAIN+'/cdn-cgi/access/certs');return Response.json({keys:[jwk]})};
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
async function token(changes={},headerChanges={}){
 const now=Math.floor(Date.now()/1000);
 const h=enc({alg:'RS256',kid:'test-key',...headerChanges});
 const p=enc({email:owner,iss:env.TEAM_DOMAIN,aud:[env.POLICY_AUD],exp:now+300,nbf:now-1,...changes});
 const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(h+'.'+p));
 return h+'.'+p+'.'+Buffer.from(sig).toString('base64url');
}
test('requires owner and Access configuration before returning workspace data',async()=>{
 assert.equal((await authorize(request(),{},{})).status,503);
 assert.equal((await authorize(request(),{OWNER_EMAIL:owner},{})).status,503);
 assert.equal((await authorize(request(),env,{})).status,403);
 assert.equal((await authorize(request(),{...env,TEAM_DOMAIN:'https://attacker.example'},{})).status,503);
});
test('accepts platform-verified owner and rejects another account member',async()=>{
 assert.equal(await authorize(request(),env,{access:{getIdentity:async()=>({email:owner})}}),null);
 assert.equal((await authorize(request(),env,{access:{getIdentity:async()=>({email:'other@example.com'})}})).status,403);
});
test('validates signature, audience, issuer, expiry, not-before and exact email',async()=>{
 assert.equal(await authorize(request(await token()),env,{}),null);
 for(const claims of [{email:'other@example.com'},{aud:['wrong']},{iss:'https://other.cloudflareaccess.com'},{exp:0},{nbf:Math.floor(Date.now()/1000)+300}])assert.equal((await authorize(request(await token(claims)),env,{})).status,403);
 assert.equal((await authorize(request(await token({}, {alg:'none'})),env,{})).status,403);
 const signed=await token();const parts=signed.split('.');parts[1]=enc({email:owner,iss:env.TEAM_DOMAIN,aud:[env.POLICY_AUD],exp:Date.now()/1000+999});
 assert.equal((await authorize(request(parts.join('.')),env,{})).status,403);
 assert.equal((await authorize(request('not-a-token'),env,{})).status,403);
});
test.after(()=>{globalThis.fetch=originalFetch});
