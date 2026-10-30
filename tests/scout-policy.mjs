import test from 'node:test';import assert from 'node:assert/strict';
import {cleanUrl,checkHistory,isFresh,jobKey,followUps,matchScore} from '../lib/policy.mjs';
const now=Date.parse('2026-10-30T14:00:00Z');
const job={company:'Example Ltd.',role:'Senior Customer Support Specialist',url:'https://jobs.example.com/apply?jk=123&utm_source=social',postedAt:'2026-10-30T13:30:00Z',eligibility:'confirmed',openVerified:true,historyCheck:'clear'};
test('freshness requires timezone-bearing original timestamp, eligible geography and clear history',()=>{
 assert.equal(isFresh(job,now),true);
 for(const change of [{postedAt:'2026-10-30'},{postedAt:null},{postedAt:'2026-10-29T13:59:59Z'},{postedAt:'2026-10-30T15:00:00Z'},{postedAt:'2026-10-30T13:30:00'},{eligibility:'unconfirmed'},{openVerified:false},{historyCheck:'prior application'},{talentPool:true}])assert.equal(isFresh({...job,...change},now),false,JSON.stringify(change));
});
test('URL cleanup removes tracking while retaining requisition identity',()=>{
 assert.equal(cleanUrl(job.url),'https://jobs.example.com/apply?jk=123');
 assert.notEqual(cleanUrl(job.url),cleanUrl(job.url.replace('123','456')));
 assert.throws(()=>cleanUrl('http://example.com'));
 assert.equal(jobKey(job),jobKey({...job,company:'EXAMPLE LIMITED',role:'Sr. Customer Support Specialist'}));
});
test('known applications/rejections and failed delivery cannot enter clear history',()=>{
 const history=[{company:'Example',role:job.role,status:'applied; later outcome not found'}];
 assert.equal(checkHistory(job,history).status,'prior application');
 assert.equal(checkHistory(job,[{...history[0],status:'rejected 2026-10-20'}]).status,'prior rejection');
 assert.equal(checkHistory(job,[{...history[0],status:'delivery failed; successful later delivery not found'}]).status,'unconfirmed');
 assert.equal(checkHistory(job,[{...history[0],status:'prepared/discussed; submission not found'}]).status,'unconfirmed');
});
test('similar roles at a known employer and unknown-company records require review',()=>{
 assert.equal(checkHistory({...job,role:'Customer Support Associate'},[{company:'Example Ltd',role:'Customer Support Specialist',status:'applied'}]).status,'unconfirmed');
 assert.equal(checkHistory(job,[{company:'not found',role:job.role,status:'applied'}]).status,'unconfirmed');
 assert.equal(checkHistory(job,[{company:'Unrelated',role:job.role,status:'applied'}]).status,'clear');
});
test('dashboard application status blocks recommendation even when URL changes',()=>{
 const previous={...job,id:'previous',url:'https://jobs.example.com/other'};
 assert.equal(checkHistory(job,[],{previous:{status:'rejected'}},[previous]).status,'prior rejection');
});
test('follow-up dates exclude weekends and ambiguous/replied/rejected histories',()=>{
 const h={company:'Example',role:'Support',date:'2026-10-23',status:'applied; later outcome not found'};
 const results=followUps([h,{...h,date:'2026-10-23 and 2026-10-25'},{...h,status:'rejected'},{...h,status:'replied'}],new Date(now));
 assert.equal(results.length,1);assert.equal(results[0].businessDays,5);
});
test('match ranking rewards confirmed eligibility, preferred pay and last-hour freshness',()=>{
 const score=matchScore({...job,salaryMonthly:900,salaryCurrency:'USD'},{payFloor:700},now);
 assert.equal(score.total,100);
 assert.ok(score.total>matchScore({...job,eligibility:'unconfirmed',salaryMonthly:500,salaryCurrency:'USD'},{payFloor:700},now).total);
});
