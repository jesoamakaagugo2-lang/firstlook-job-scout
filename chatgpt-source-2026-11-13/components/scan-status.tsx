'use client';
import {Clock,ArrowUpRight} from 'lucide-react';
export default function ScanStatus({at,loaded,error,onViewReports,intervalMinutes=180}:{at?:string;intervalMinutes?:number;loaded:boolean;error:boolean;onViewReports:()=>void}){
 const valid=!!at&&Number.isFinite(Date.parse(at));
 const age=valid?Math.max(0,Math.floor((Date.now()-Date.parse(at!))/60000)):null;
 const stale=age!==null&&age>intervalMinutes+30;
 const label=valid?new Date(at!).toLocaleString('en-GB',{timeZone:'Africa/Lagos',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true})+' WAT':error?'Scan history unavailable':loaded?'No scans recorded on this site':'Loading scan history…';
 return <section aria-label="Scan activity" style={{background:'#fff',border:'1px solid #d9e2da',borderRadius:10,padding:'20px 23px',marginBottom:22,display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:18}}>
 <div style={{display:'flex',alignItems:'flex-start',gap:13,minWidth:0,flex:'1 1 270px'}}><Clock size={23} aria-hidden="true" style={{color:'#416c4d',flexShrink:0,marginTop:3}}/><div style={{minWidth:0}}><p style={{margin:'0 0 7px',color:'#526356',fontSize:11,fontWeight:700,letterSpacing:'.4px'}}>LAST JOB CHECK</p><div aria-live="polite" style={{fontFamily:'Manrope, sans-serif',fontSize:18,fontWeight:700,lineHeight:1.5,color:'#213f35'}}>{valid?<time dateTime={at}>{label}</time>:label}</div><p role="status" style={{margin:'7px 0 0',fontSize:11,lineHeight:1.8,color:'#65746a'}}>{stale?'Scan overdue — last saved report was '+age+' minutes ago. Check the scout connection.':error?'Couldn’t refresh scan history. Any displayed time is from the last saved report we loaded.':valid?'Checks run every three hours. This is the last saved scan-report time. Refresh desk reloads reports; it does not start a new scan.':loaded?'A date and time will appear here after this site receives its first scan report.':'Checking this site’s saved reports.'}</p></div></div>
 <button onClick={onViewReports} style={{display:'flex',alignItems:'center',gap:7,padding:'10px 12px',border:'1px solid #dbe5dc',borderRadius:6,background:'#f2f6f0',color:'#416c4d',fontSize:11}}>View scan reports <ArrowUpRight size={15}/></button>
 </section>;
}
