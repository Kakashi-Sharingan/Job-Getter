import {validateJob,validDate,localToday,transition} from './tracker.mjs';
export function receiptEventDate(timestamp,timeZone='UTC'){
 const date=new Date(timestamp);if(!Number.isFinite(+date))throw Error('Invalid receipt timestamp');
 try{const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);const get=k=>parts.find(p=>p.type===k).value;return `${get('year')}-${get('month')}-${get('day')}`;}catch{throw Error('Invalid receipt time zone');}
}
export function parseApplicationBatch(text,previous={}){
 const batch=JSON.parse(text);
 if(batch?.version!==1||batch.kind!=='job-getter-application-batch'||!Array.isArray(batch.applications)||batch.applications.length>500)throw Error('Unsupported application batch');
 if(!Number.isInteger(batch.target)||batch.target<1||batch.target>1000)throw Error('Invalid application target');
 const result=Object.create(null),seen=new Set();
 for(const item of batch.applications){
  const job=validateJob(item.job);if(seen.has(job.id))throw Error('Duplicate job in application batch');seen.add(job.id);
  if(!['prepared','approved','blocked','unknown','submitted','delivery_failed'].includes(item.status))throw Error('Invalid application outcome');
  if(!validDate(item.event_date)||item.event_date>localToday())throw Error('Invalid application event date');
  const failed=item.status==='delivery_failed';
  let status={prepared:'Prepared',approved:'Approved',blocked:'Blocked',unknown:'Needs review',submitted:'Applied',delivery_failed:'Delivery failed'}[item.status];
  let note=String(item.notes||'').slice(0,2500);
  if(item.status==='submitted'||failed){
   const r=item.receipt;
   if(!r||r.status!=='submitted'||r.job_id!==job.id||typeof r.confirmation_text!=='string'||!r.confirmation_text.trim()||!/^\d{4}-\d{2}-\d{2}T/.test(r.submitted_at)||!Number.isFinite(Date.parse(r.submitted_at))||(!failed&&receiptEventDate(r.submitted_at,item.event_timezone||'UTC')!==item.event_date)||!/^[a-f0-9]{64}$/.test(r.manifest_sha256||''))throw Error('Submitted outcome requires a matching employer receipt');
   const u=new URL(r.confirmation_url),gh=job.id.match(/^greenhouse:([a-z0-9-]+):(\d+)$/i);
   const hosted=gh&&u.origin==='https://job-boards.greenhouse.io'&&u.pathname===`/${gh[1]}/jobs/${gh[2]}/confirmation`;
   const embedded=gh&&u.origin==='https://job-boards.greenhouse.io'&&u.pathname==='/embed/job_app/confirmation'&&u.searchParams.getAll('for').length===1&&u.searchParams.get('for')===gh[1]&&u.searchParams.getAll('token').length===1&&u.searchParams.get('token')===gh[2];
   const mailed=r.channel==='email'&&r.provider==='gmail'&&r.provider_status==='sent'&&r.sent_verified===true&&/^[a-f0-9]+$/.test(r.message_id||'')&&u.origin==='https://mail.google.com'&&u.hash===`#sent/${r.message_id}`;
   const employer=u.origin===new URL(job.url).origin&&(!gh||u.origin!=='https://job-boards.greenhouse.io');
   if(u.protocol!=='https:'||(!hosted&&!embedded&&!mailed&&!employer))throw Error('Receipt origin does not match employer');
   if(failed){
    const f=item.delivery_failure;
    if(!mailed||!f||f.provider!=='gmail'||f.job_id!==job.id||f.original_message_id!==r.message_id||!/^[a-f0-9]+$/.test(f.message_id||'')||typeof f.reason!=='string'||!f.reason.trim()||!/^\d{4}-\d{2}-\d{2}T/.test(f.failed_at||'')||!Number.isFinite(Date.parse(f.failed_at))||Date.parse(f.failed_at)<Date.parse(r.submitted_at)||receiptEventDate(f.failed_at,item.event_timezone||'UTC')!==item.event_date)throw Error('Delivery failure requires evidence matching the original sent application');
    const source=new URL(f.confirmation_url);
    if(source.origin!=='https://mail.google.com'||source.hash!==`#all/${f.message_id}`)throw Error('Delivery failure message does not match Gmail evidence');
    note+=`\nDelivery failed: ${f.reason.slice(0,800)}\nFailure evidence: ${source.href}\nExcluded from application goals. Original sent attempt is retained.`;
   }else if(mailed)note+='\nApplication sent by email. Employer delivery and acknowledgement are not verified.';
   note+=`\nImported worker receipt: ${u.href}\nSubmitted: ${r.submitted_at}\nManifest SHA-256: ${r.manifest_sha256}\n${r.confirmation_text.slice(0,800)}\nReceipt is imported evidence; this static dashboard does not independently verify it.`;
  }
  const old=previous[job.id];
  if(old&&!(failed&&old.status==='Applied')&&!['Saved','Reviewed','Prepared','Approved','Blocked','Needs review'].includes(old.status)){
   result[job.id]=old; // Preserve actual application progress when importing an older queue.
  }else {
   const basis=failed&&!old?.application_snapshot?transition(old,job,'Applied',receiptEventDate(item.receipt.submitted_at,item.event_timezone||'UTC'),note):old;
   result[job.id]=transition(basis,job,status,item.event_date,note,old?.followup||'');
  }
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
