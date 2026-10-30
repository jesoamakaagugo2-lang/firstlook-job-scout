import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../.github/workflows/scout-relay.yml',import.meta.url),'utf8');
const script=workflow.split('          script: |\n')[1].split('\n').map(line=>line.startsWith('            ')?line.slice(12):line).join('\n');
const run=new (Object.getPrototypeOf(async function(){}).constructor)('github','context','core','fetch','process',script);
async function relay(input,broken=false){
 const comments=[],calls=[];let closed=false,failed=false;
 const state={history:[{company:'Example',role:'Support',originalTrackerRow:{source:'raw'}}],jobs:[],reports:broken?[]:[{id:'run-1',at:'2026-10-30T14:00:00Z'}],migration:{},system:{}};
 const github={rest:{issues:{createComment:async x=>comments.push(x.body),update:async()=>{closed=true}}}};
 const context={repo:{owner:'owner',repo:'repo'},issue:{number:1},payload:{issue:{body:JSON.stringify(input)}}};
 const core={setFailed:()=>{failed=true}};
 const fetch=async(url,options={})=>{calls.push({url,options});return Response.json(options.method==='POST'?{id:'run-1'}:state)};
 await run(github,context,core,fetch,{env:{SCOUT_REPORT_TOKEN:'local-test-only'}});
 return {comments,calls,closed,failed};
}
test('relay checks POST with GET and reports exact saved run, without exposing auth',async()=>{
 const r=await relay({kind:'report',report:{runId:'run-1',jobs:[]}});
 assert.equal(r.calls.length,2);assert.equal(r.calls[0].options.redirect,'error');assert.equal(r.closed,true);assert.equal(r.failed,false);
 assert.match(r.comments[0],/FIRSTLOOK_READBACK_VERIFIED/);assert.ok(!r.comments.join('').includes('local-test-only'));
});
test('successful POST without persisted report is explicitly a failure',async()=>{
 const r=await relay({kind:'report',report:{runId:'run-1'}},true);
 assert.equal(r.failed,true);assert.equal(r.closed,false);assert.match(r.comments[0],/FIRSTLOOK_RELAY_FAILED/);assert.ok(!r.comments.join('').includes('READBACK_VERIFIED'));
});
test('state transport is reconstructable and omits redundant raw tracker data',async()=>{
 const r=await relay({kind:'state'});const state=JSON.parse(r.comments.map(s=>s.slice(s.indexOf('\n')+1)).join(''));
 assert.equal(state.history.length,1);assert.equal(state.history[0].originalTrackerRow,undefined);assert.equal(r.closed,true);
});
test('workflow is restricted to owner-created requests in the private repository',()=>{
 assert.match(workflow,/github\.event\.repository\.private == true/);assert.match(workflow,/issue\.user\.login == github\.repository_owner/);assert.match(workflow,/contents: read/);assert.ok(!workflow.includes('contents: write'));
});
