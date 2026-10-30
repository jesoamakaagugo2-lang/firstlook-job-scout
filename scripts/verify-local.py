"""Exercise the built Worker with an isolated local D1 migration (never production)."""
import subprocess,tempfile,urllib.request,urllib.error,json,time,datetime,os
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Run local migrations and test server within one executor process/network namespace.
with tempfile.TemporaryDirectory(prefix='firstlook-check-') as temp:
 with open(temp+'/wrangler.log','w+') as log:
  subprocess.run(['node','node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config','wrangler.jsonc','--persist-to',temp+'/db'],cwd=root,stdout=log,stderr=log,check=True)
  token='local-test-credential-not-a-production-secret'
  proc=subprocess.Popen(['node','node_modules/wrangler/bin/wrangler.js','dev','--local','--config','dist/server/wrangler.json','--persist-to',temp+'/db','--port','8801','--inspector-port','0','--var','SCOUT_REPORT_TOKEN:'+token],cwd=root,stdout=log,stderr=log)
  def call(path='/api/report',payload=None,auth=True,retries=2):
   headers={'Content-Type':'application/json'}
   if auth:headers['Authorization']='Bearer '+token
   request=urllib.request.Request('http://127.0.0.1:8801'+path,headers=headers,data=json.dumps(payload).encode() if payload is not None else None)
   try:
    with urllib.request.urlopen(request,timeout=10) as r:return r.status,json.load(r)
   except urllib.error.HTTPError as e:
    body=e.read().decode()[:1200]
    if e.code==503 and 'restarted mid-request' in body and retries:
     time.sleep(.5);return call(path,payload,auth,retries-1)
    return e.code,body
  try:
   for attempt in range(80):
    try:
     status,state=call()
     if status!=200:raise RuntimeError('Worker responded HTTP '+str(status))
     break
    except urllib.error.URLError:
     if proc.poll() is not None:raise RuntimeError('Local worker stopped')
     time.sleep(.25)
   else:raise RuntimeError('Local worker did not start')
   assert len(state['history'])==153
   assert len(state['reports'])==3
   assert call(auth=False)[0]==401
   assert call('/api/scout')[0]==403
   assert call('/api/settings',{})[0]==403
   now=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
   job={'company':'Local Test Fixture','role':'Customer Support Specialist','url':'https://example.com/job?jk=one&utm_source=test','evidence':'Local fixture, not a real job','postedAt':now,'eligibility':'confirmed','openVerified':True,'historyCheck':'clear','location':'Remote Nigeria','salary':'Undisclosed'}
   payload={'runId':'local-verification','summary':'Local fixture only','jobs':[job,{**job,'url':'https://example.com/repost'}],'sources':[]}
   status,report=call(payload=payload);assert status==200 and report['found']==1 and report['freshCount']==1,(status,report)
   status,duplicate=call(payload=payload);assert status==200 and duplicate['duplicate']
   state=call()[1];assert len(state['jobs'])==4 and len(state['reports'])==4
   assert any(r['id']=='local-verification' for r in state['reports'])
   bad={**payload,'runId':'bad-date','jobs':[{**job,'postedAt':now[:10]}]}
   assert call(payload=bad)[0]==400
   repeated={**payload,'runId':'history-check','jobs':[{**job,'company':'Subsi','role':'Customer Success Associate','url':'https://example.com/subsi'}]}
   report=call(payload=repeated)[1];assert report['freshCount']==0,report
   backup=call('/api/report?backup=1')[1];assert len([r for r in backup['entries'] if r['kind']=='history'])==153
   print(json.dumps({'passed':True,'migratedHistory':153,'migratedReports':3,'anonymousBlocked':True,'ownerRoutesRejectReportToken':True,'postReadbackAndRetry':True,'dateOnlyRejected':True,'historyGate':True,'backupExport':True}))
  except Exception:
   log.seek(0);print(log.read()[-4000:]);raise
  finally:
   proc.terminate()
   try:proc.wait(timeout=5)
   except subprocess.TimeoutExpired:proc.kill()
