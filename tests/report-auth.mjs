import test from 'node:test';import assert from 'node:assert/strict';import {reportAuthorization} from '../worker/report-auth.mjs';
const value='test-only-credential-with-more-than-32-characters';
const req=(path='/api/report',method='POST',token=value)=>new Request('https://example.com'+path,{method,headers:token?{Authorization:'Bearer '+token}:{}});
test('report access fails closed with no configured secret',async()=>assert.equal((await reportAuthorization(req(),{})).status,503));
test('correct credential can read/write the report endpoint only',async()=>{
 for(const method of ['GET','POST'])assert.equal(await reportAuthorization(req('/api/report',method),{SCOUT_REPORT_TOKEN:value}),null);
 for(const path of ['/api/scout','/api/settings','/api/report/','/api/report/anything','/'])assert.equal((await reportAuthorization(req(path),{SCOUT_REPORT_TOKEN:value})).status,403);
 assert.equal((await reportAuthorization(req('/api/report','DELETE'),{SCOUT_REPORT_TOKEN:value})).status,405);
});
test('missing, wrong and oversized authorization fail',async()=>{
 for(const token of ['',value+'x','x'.repeat(2000)])assert.equal((await reportAuthorization(req('/api/report','POST',token),{SCOUT_REPORT_TOKEN:value})).status,401);
});
