"""Prepare an audited, repeatable migration from an original Site export + tracker.
Usage: python scripts/prepare-migration.py SNAPSHOT_JSON TRACKER_CSV OUTPUT_SQL
Inputs/outputs contain personal job data; keep this repository private. No secrets.
"""
import csv,json,sys,datetime,sqlite3
snapshot=json.load(open(sys.argv[1]));tracker=list(csv.DictReader(open(sys.argv[2])))
now=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
old={(h['company'].lower(),h['role'].lower()):h for h in snapshot['history']}
records=[];missing=[]
for row in tracker:
 key=(row['Company'].lower(),row['Role'].lower());previous=old.get(key,{})
 record={**previous,'company':row['Company'],'role':row['Role'],'date':row['Date applied'],'url':row['Where I applied (platform/link)'],'status':row['Status'],'salary':row['Pay range stated'],'location':row['Remote and Nigeria-eligible?'],'contact':row['Contact person or email'],'nextAction':row['Next action and date'],'resume':row['Resume version used'],'trackerIndex':int(row['index']),'source':'October tracker libfile_dfdd33c3255081919b697aeef76ea59f','originalTrackerRow':row}
 if key not in old:missing.append({'trackerRow':int(row['index'])+1,'company':row['Company'],'role':row['Role']})
 ident='history:'+row['Company'].lower()+':'+row['Role'].lower() if previous else 'history:october-row:'+row['index']
 records.append((ident,'history',record,now))
# Preserve source history entries that aren't present in the tracker, if any.
keys={(r['Company'].lower(),r['Role'].lower()) for r in tracker}
for key,h in old.items():
 if key not in keys:records.append(('history:'+key[0]+':'+key[1],'history',h,now))
for j in snapshot['jobs']:records.append(('job:'+j['id'],'job',j,j.get('firstSeen',now)))
for r in snapshot['reports']:records.append(('report:'+r['id'],'report',r,r['at']))
for ident,status in snapshot.get('statuses',{}).items():records.append(('status:'+ident,'status',status,status.get('at',now)))
audit={'at':now,'trackerRows':len(tracker),'originalHistory':len(snapshot['history']),'restoredUnknownEmployerRows':missing,'expectedHistory':sum(r[1]=='history' for r in records),'reports':len(snapshot['reports']),'jobs':len(snapshot['jobs']),'source':'Original private Site snapshot plus complete October tracker','cutoverVerified':False}
records.append(('migration:october-2026','migration',audit,now))
def quoted(s):return "'"+str(s).replace("'","''")+"'"
statements=['-- Audited snapshot. Does not delete destination data. Retire original only after live readback.']
for ident,kind,payload,created in records:
 # Enrich imported history; preserve any already-created Cloudflare reports/jobs/statuses.
 conflict='DO UPDATE SET payload=excluded.payload' if kind=='history' else 'DO NOTHING'
 values=','.join(map(quoted,[ident,kind,json.dumps(payload,ensure_ascii=False),created]))
 statements.append('INSERT INTO entries (id,kind,payload,created) VALUES ('+values+') ON CONFLICT(id) '+conflict+';')
text='\n'.join(statements)+'\n'
# Check validity, exact counts and re-run idempotency before writing the migration.
con=sqlite3.connect(':memory:');con.execute('CREATE TABLE entries (id TEXT PRIMARY KEY,kind TEXT NOT NULL,payload TEXT NOT NULL,created TEXT NOT NULL)');con.executescript(text);con.executescript(text)
counts=dict(con.execute('SELECT kind,count(*) FROM entries GROUP BY kind'))
assert counts['history']==audit['expectedHistory']
assert counts['report']==audit['reports']
assert counts['job']==audit['jobs']
open(sys.argv[3],'w').write(text)
print(json.dumps({'counts':counts,'missing':missing,'idempotent':True},indent=2))
