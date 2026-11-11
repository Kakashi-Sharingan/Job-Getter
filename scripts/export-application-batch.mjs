// Export private worker outcomes for a local-only dashboard import.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
const [queueFile,outFile]=process.argv.slice(2);
if(!queueFile||!outFile)throw Error('Usage: node scripts/export-application-batch.mjs <private-queue.json> <private-output.json>');
const root=dirname(resolve(queueFile)),queue=JSON.parse(readFileSync(queueFile)),approval=join(root,'approval.json');
const applications=queue.prepared.map(row=>{
 const base=join(root,'review',String(row.number).padStart(2,'0'));
 const read=name=>existsSync(join(base,name))?JSON.parse(readFileSync(join(base,name))):null;
 const receipt=read('receipt.json'),attempt=read('attempt.json'),manifest=read('approved-manifest.json'),error=read('outcome-error.json');
 let status='prepared',notes=row.fit_notes||'';
 if(existsSync(approval))status='approved';
 const unknowns=(row.proposed_answers||[]).filter(a=>a.answer.startsWith('BLOCKED')).map(a=>a.question);
 unknowns.push(...Object.entries(row.custom_proposed_answers||{}).filter(([,a])=>a.startsWith('BLOCKED')).map(([q])=>q));
 if(unknowns.length||manifest?.blockers?.length||!manifest){status='blocked';notes+='\nRequired answers or form adapter need review: '+[...unknowns,...manifest?.blockers||[]].join('; ');}
 if(error){status='blocked';notes+='\nWorker stopped: '+error.error;}
 if(attempt&&!receipt){status='unknown';notes+='\nSubmission outcome requires reconciliation. Do not retry automatically.';}
 if(receipt){
  if(!manifest||receipt.status!=='submitted'||receipt.job_id!==row.job.id||receipt.manifest_sha256!==createHash('sha256').update(readFileSync(join(base,'approved-manifest.json'))).digest('hex'))throw Error('Receipt/manifest identity mismatch');
  for(const [name,hash] of Object.entries(manifest.files||{}))if(createHash('sha256').update(readFileSync(join(base,name))).digest('hex')!==hash)throw Error('Submitted attachment changed');
  status='submitted';
 }
 return {job:row.job,status,event_date:(receipt?.submitted_at||new Date().toISOString()).slice(0,10),notes,...(receipt?{receipt}:{})};
});
const batch={version:1,kind:'job-getter-application-batch',target:queue.target||50,exported_at:new Date().toISOString(),applications};
writeFileSync(resolve(outFile),JSON.stringify(batch,null,2));
console.log(JSON.stringify({applications:applications.length,outcomes:applications.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})}));
