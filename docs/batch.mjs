import {validateJob,validDate,localToday,transition} from './tracker.mjs';
export function parseApplicationBatch(text,previous={}){
 const batch=JSON.parse(text);
 if(batch?.version!==1||batch.kind!=='job-getter-application-batch'||!Array.isArray(batch.applications)||batch.applications.length>500)throw Error('Unsupported application batch');
 if(!Number.isInteger(batch.target)||batch.target<1||batch.target>1000)throw Error('Invalid application target');
 const result=Object.create(null),seen=new Set();
 for(const item of batch.applications){
  const job=validateJob(item.job);if(seen.has(job.id))throw Error('Duplicate job in application batch');seen.add(job.id);
  if(!['prepared','approved','blocked','unknown','submitted'].includes(item.status))throw Error('Invalid application outcome');
  if(!validDate(item.event_date)||item.event_date>localToday())throw Error('Invalid application event date');
  let status={prepared:'Prepared',approved:'Approved',blocked:'Blocked',unknown:'Needs review',submitted:'Applied'}[item.status];
  let note=String(item.notes||'').slice(0,2500);
  if(item.status==='submitted'){
   const r=item.receipt;
   if(!r||r.status!=='submitted'||r.job_id!==job.id||typeof r.confirmation_text!=='string'||!r.confirmation_text.trim()||!/^\d{4}-\d{2}-\d{2}T/.test(r.submitted_at)||!Number.isFinite(Date.parse(r.submitted_at))||r.submitted_at.slice(0,10)!==item.event_date||!/^[a-f0-9]{64}$/.test(r.manifest_sha256||''))throw Error('Submitted outcome requires a matching employer receipt');
   const u=new URL(r.confirmation_url),gh=job.id.match(/^greenhouse:([a-z0-9-]+):(\d+)$/i);
   const hosted=gh&&u.origin==='https://job-boards.greenhouse.io'&&u.pathname===`/${gh[1]}/jobs/${gh[2]}/confirmation`;
   if(u.protocol!=='https:'||(!hosted&&u.origin!==new URL(job.url).origin))throw Error('Receipt origin does not match employer');
   note+=`\nImported worker receipt: ${u.href}\nSubmitted: ${r.submitted_at}\nManifest SHA-256: ${r.manifest_sha256}\n${r.confirmation_text.slice(0,800)}\nReceipt is imported evidence; this static dashboard does not independently verify it.`;
  }
  const old=previous[job.id];
  if(old&&!['Saved','Reviewed','Prepared','Approved','Blocked','Needs review'].includes(old.status)){
   result[job.id]=old; // Preserve actual application progress when importing an older queue.
  }else result[job.id]=transition(old,job,status,item.event_date,note,old?.followup||'');
 }
 return {records:result,target:batch.target};
}
export function batchProgress(records,target=50){
 const counts={prepared:0,approved:0,blocked:0,unknown:0,applied:0};
 for(const r of Object.values(records)){
  if(r.status==='Prepared')counts.prepared++;
  else if(r.status==='Approved')counts.approved++;
  else if(r.status==='Blocked')counts.blocked++;
  else if(r.status==='Needs review')counts.unknown++;
  else if(['Applied','Responded','Assessment','Interview','Offer','Hired','Rejected'].includes(r.status)&&r.application_snapshot)counts.applied++;
 }
 return {...counts,target,remaining:Math.max(0,target-counts.applied)};
}
