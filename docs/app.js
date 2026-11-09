'use strict';
import {analyzeRoleClarity} from './vendor/role-clarity.mjs';
import {readResumeFile} from './resume-parser.mjs';
import {createApplication,validateProfile} from './tailor.mjs';
import {createPDF,applicationBlocks} from './pdf.mjs';
import {matchesQuery,matchesLocation} from './search.mjs';
import {parseFeed} from './feed.mjs';
import {STATUSES,localToday,transition,backup,parseBackup,validateJob} from './tracker.mjs';
const assetBase=new URL('.',import.meta.url),$=id=>document.getElementById(id);
let data={jobs:[]},onlySaved=false,current=null,clarity=null,records=Object.create(null),legacy={};
let verifiedProfile=null,tailoredApplication=null;
let storageLocked=false,originalStored=null;
function storageNotice(message, recovery=false){
 $('storageWarning').hidden=false;$('storageMessage').textContent=message;
 $('recoverStorage').hidden=!recovery;$('resetStorage').hidden=!recovery;
}
try {
 originalStored=localStorage.getItem('job-getter-tracker-v1');
 if(originalStored)records=parseBackup(originalStored);
} catch {
 storageLocked=originalStored!==null;
 storageNotice(storageLocked?'Your stored tracker could not be read. It is protected from overwriting. Download the original data before resetting. New changes last for this visit only.':'Browser storage is unavailable. Export your tracker to keep any changes.',storageLocked);
}
try {const old=JSON.parse(localStorage.getItem('job-getter-status')||'{}');if(old&&typeof old==='object'&&!Array.isArray(old))legacy=old;}catch{}
function persist(){
 if(storageLocked)return false;
 try{localStorage.setItem('job-getter-tracker-v1',backup(records));return true;}
 catch{storageNotice('Browser storage is unavailable or full. Your latest changes last for this visit only. Open My pipeline and export your tracker to keep them.');return false;}
}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function validURL(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
function download(content,name,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function listedJobs(){const all=new Map(data.jobs.map(j=>[j.id,j]));if(onlySaved)for(const r of Object.values(records))if(!all.has(r.job.id))all.set(r.job.id,{...r.job,stale:true,archived:true});return [...all.values()];}
function render(){
 const q=$('query').value.toLowerCase(),loc=$('location').value.toLowerCase(),limit=Number($('threshold').value),stage=$('stageFilter').value;
 const candidates=listedJobs().filter(j=>matchesQuery(j,q)&&matchesLocation(j,loc));
 const hiddenByFit=onlySaved?0:candidates.filter(j=>j.score<limit).length;
 $('searchStatus').textContent=hiddenByFit?`${hiddenByFit} matching roles hidden by minimum fit. Choose Any fit to include them.`:'';
 const jobs=listedJobs().filter(j=>(onlySaved?!!records[j.id]:j.score>=limit)&&(!onlySaved||!stage||records[j.id].status===stage)&&matchesQuery(j,q)&&matchesLocation(j,loc)).sort((a,b)=>b.score-a.score);
 $('jobs').replaceChildren();$('count').textContent=jobs.length;$('saved').textContent=Object.keys(records).length;$('strong').textContent=data.jobs.filter(j=>j.score>=limit).length;
 $('allNav').classList.toggle('active',!onlySaved);$('savedNav').classList.toggle('active',onlySaved);$('pipelineTools').hidden=!onlySaved;$('stageFilter').hidden=!onlySaved;$('threshold').disabled=onlySaved;
 $('listTitle').firstChild.textContent=onlySaved?'Your private pipeline ':'Your opportunities ';
 if(!jobs.length)$('jobs').append(el('div','empty',onlySaved?'Your pipeline has no matches. Save a role from Discover to begin.':'No matching roles. Try a lower threshold or another location.'));
 for(const j of jobs){
  const record=records[j.id],card=el('article','job'),avatar=el('div','avatar',j.company[0]?.toUpperCase()||'?'),body=el('div'),right=el('div','right');
  body.append(el('div','company',j.company),el('h3','',j.title),el('div','meta',`${j.location} · ${j.source}${j.archived?' · Not in current feed; verify at employer':j.stale?' · Feed stale; verify at employer':''}`));
  const tags=el('div','tags');for(const s of j.matched_skills.slice(0,6))tags.append(el('span','tag',s));if(record)tags.append(el('span','tag stage-badge',record.status));body.append(tags);
  if(record?.followup)body.append(el('p',record.followup<=localToday()?'due':'history-note',`Follow-up ${record.followup<=localToday()?'due':'planned'}: ${record.followup} · Reminder only`));
  right.append(el('div','score',`${j.score}% keyword fit`));const buttons=el('div','job-buttons'),save=el('button','',record?'♥ Tracked':'♡ Save'),view=el('button','primary','Review role ↗');
  save.setAttribute('aria-label',`Save ${j.title} at ${j.company}`);save.onclick=()=>{if(record){openJob(j);return;}records[j.id]=transition(null,j,'Saved',localToday());persist();render();};view.onclick=()=>openJob(j);buttons.append(save,view);right.append(buttons);card.append(avatar,body,right);$('jobs').append(card);
 }
}
function openJob(j){
 current=j;tailoredApplication=null;$('tailoredDownloads').hidden=true;$('tailoredStatus').textContent='';clarity=analyzeRoleClarity(j.description);const r=records[j.id];
 $('detailTitle').textContent=j.title;$('detailMeta').textContent=`${j.company} · ${j.location} · ${j.score}% keyword fit${j.description_truncated?' · Description shortened; read full posting':''}`;$('description').textContent=j.description;$('detailSkills').replaceChildren(...j.matched_skills.map(s=>el('span','tag',s)));const url=validURL(j.url);$('applyLink').hidden=!url;if(url)$('applyLink').href=url;
 $('reviewButton').textContent=r?.status==='Reviewed'?'Reviewed in this browser ✓':'Mark reviewed locally';$('exportStatus').textContent='';$('stageStatus').textContent='';$('stage').value=r?.status||'Saved';$('eventDate').value=r?.event_date||localToday();$('eventDate').max=localToday();$('notes').value=r?.notes||'';$('followupDate').value=r?.followup||'';$('submittedConfirm').checked=false;
 $('clarityPoints').replaceChildren();for(const point of clarity.points){const row=el('div','clarity-point');row.append(el('strong','',`${point.label} — ${point.status}`));for(const quote of point.evidence)row.append(el('blockquote','',quote));$('clarityPoints').append(row);}
 $('questionsHeading').hidden=!clarity.questions.length;$('questions').replaceChildren(...clarity.questions.map(x=>el('li','',x.question)));$('detail').showModal();
}
$('close').onclick=()=>$('detail').close();$('detail').addEventListener('close',()=>{$('resume').value='';tailoredApplication=null;});
$('reviewButton').onclick=()=>{if(!current)return;const previous=records[current.id];if(previous&&!['Saved','Reviewed'].includes(previous.status)){$('stageStatus').textContent='Your application stage is preserved. Use the stage editor for changes.';return;}records[current.id]=transition(previous,current,'Reviewed',localToday(),previous?.notes||'',previous?.followup||'');persist();$('reviewButton').textContent='Reviewed in this browser ✓';$('stage').value='Reviewed';$('eventDate').value=localToday();render();};
$('stage').onchange=()=>{$('eventDate').value=$('stage').value===records[current?.id]?.status?records[current.id].event_date:localToday();$('submittedConfirm').checked=false;};
$('saveStage').onclick=()=>{if(!current)return;try{const status=$('stage').value;if(status==='Applied'&&!$('submittedConfirm').checked)throw Error('Confirm you submitted the application yourself before recording Applied.');records[current.id]=transition(records[current.id],current,status,$('eventDate').value,$('notes').value,$('followupDate').value);const stored=persist();$('stageStatus').textContent=stored?'Saved privately in this browser. Nothing was submitted.':'Kept for this visit only. Browser storage failed; export a tracker backup.';render();}catch(error){$('stageStatus').textContent=error.message;}};
$('exportReview').onclick=()=>{if(!current)return;download(JSON.stringify({version:1,generated_at:new Date().toISOString(),assessment_type:'Role clarity heuristic, not full Career Ops evaluation',job_snapshot:validateJob(current),role_clarity:clarity,eligibility:'Unverified; confirm location and authorization',source_reference:'career-ops-hq/career-ops@24da28e8307d19f3002cf32eb953ad990d71da95'},null,2),`role-review-${current.company}-${current.id.split(':').pop()}.json`);};
$('export').onclick=async()=>{
 if(!current)return;const resume=$('resume').value.trim();if(!resume){$('exportStatus').textContent='Paste your resume text first.';return;}const j=current;
 const letter=`Dear Hiring Team,\n\nI am applying for the ${j.title} position at ${j.company}. Please find my resume below for your consideration.\n\n[Before sending: add a specific example from your real experience that addresses an important requirement in this posting.]\n\nI would welcome the opportunity to discuss the role and how my background relates to your team's needs. Thank you for considering my application.\n\nSincerely,\n[Your name]`;
 const packageData={job_id:j.id,job_url:j.url,job_content_hash:j.content_hash,job_snapshot:validateJob(j),application_snapshot:records[j.id]?.application_snapshot||null,role_clarity:clarity,prepared_at:new Date().toISOString(),status:'draft_not_submitted',resume_original:resume,cover_letter_draft:letter,checks_required:['Current posting and exact requisition identity','Location and work authorization','Every claim and required answer','Replace cover-letter placeholders'],note:'A local review package is not server-side submission approval.'};
 try{const content=JSON.stringify(packageData,null,2),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content)))).map(b=>b.toString(16).padStart(2,'0')).join('');download(JSON.stringify({...packageData,content_sha256:hash},null,2),`application-${j.company}-${j.id.split(':').pop()}.json`);$('exportStatus').textContent='Downloaded a draft review package with the JD snapshot. Nothing was sent or submitted.';}catch{$('exportStatus').textContent='Export failed. Keep your resume text and retry in a secure browser.';}
};

$('verifiedProfileFile').onchange=async()=>{try{const file=$('verifiedProfileFile').files[0];if(!file)return;if(file.size>5000000)throw Error('Resume exceeds 5 MB');verifiedProfile=validateProfile(await readResumeFile(file));tailoredApplication=null;$('tailoredDownloads').hidden=true;$('profileStatus').textContent=`Loaded ${verifiedProfile.name}. Kept in this visit's memory only.`;}catch(error){verifiedProfile=null;$('profileStatus').textContent=error.message;}finally{$('verifiedProfileFile').value='';}};
$('generateTailored').onclick=()=>{try{if(!current||!verifiedProfile)throw Error('Import your resume first.');tailoredApplication=createApplication(verifiedProfile,current);$('tailoredDownloads').hidden=false;$('tailoredStatus').textContent='Drafts ready. Check the XYZ source audit and review before applying. No application has been sent.';}catch(error){$('tailoredStatus').textContent=error.message;}};
for(const [button,kind] of [['downloadResume','resume'],['downloadCover','cover'],['downloadCombined','combined']])$(button).onclick=()=>{if(tailoredApplication)download(createPDF(applicationBlocks(tailoredApplication,kind)),`${kind}-${current.company}.pdf`,'application/pdf');};
$('downloadTailoredPackage').onclick=()=>{if(tailoredApplication)download(JSON.stringify(tailoredApplication,null,2),`tailored-review-${current.company}.json`);};

$('recoverStorage').onclick=()=>{if(originalStored!==null)download(originalStored,'job-getter-original-storage.txt','text/plain');};
$('resetStorage').onclick=()=>{if(!confirm('Reset the unreadable tracker? Download its original data first. This will replace it with records from this visit.'))return;try{localStorage.setItem('job-getter-tracker-v1',backup(records));storageLocked=false;originalStored=null;$('storageWarning').hidden=true;}catch{storageNotice('Reset failed because browser storage is unavailable. Download a backup of your current records.',storageLocked);}};
$('backup').onclick=()=>download(backup(records),'job-getter-private-tracker.json');$('import').onclick=()=>$('importFile').click();
$('importFile').onchange=async()=>{const file=$('importFile').files[0];if(!file)return;try{if(file.size>15000000)throw Error('Backup exceeds the 15 MB import limit');const incoming=parseBackup(await file.text());const conflicts=Object.keys(incoming).filter(id=>records[id]).length;if(!confirm(`Import ${Object.keys(incoming).length} records? This will replace ${conflicts} matching records with the backup versions. Export your current tracker first if needed.`))return;Object.assign(records,incoming);const stored=persist();$('trackerStatus').textContent=`Imported ${Object.keys(incoming).length} records${stored?' privately in this browser.':'; browser storage failed, export to keep them.'}`;render();}catch(error){$('trackerStatus').textContent=`Import stopped: ${error.message}`;}finally{$('importFile').value='';}};
for(const status of STATUSES){$('stage').append(el('option','',status));const opt=el('option','',status);opt.value=status;$('stageFilter').append(opt);}
for(const id of ['query','location','threshold','stageFilter'])$(id).addEventListener('input',render);
$('clearFilters').onclick=()=>{$('query').value='';$('location').value='';$('threshold').value='0';$('stageFilter').value='';render();};
$('allNav').onclick=()=>{onlySaved=false;render();};$('savedNav').onclick=()=>{onlySaved=true;render();};
(async()=>{
 try {
  const response=await fetch(new URL('data/jobs.json',assetBase),{cache:'no-cache'});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  data=parseFeed(await response.json());
  const remaining={...legacy};
  for(const j of data.jobs){
   if(Object.hasOwn(legacy,j.id)&&['saved','reviewed'].includes(legacy[j.id])){
    if(!records[j.id])records[j.id]=transition(null,j,legacy[j.id]==='reviewed'?'Reviewed':'Saved',localToday(),'Migrated legacy record; the event date shown is the migration date, not the original review date.');
    delete remaining[j.id];
   }
  }
  if(Object.keys(legacy).length&&persist()){
   try{if(Object.keys(remaining).length)localStorage.setItem('job-getter-status',JSON.stringify(remaining));else localStorage.removeItem('job-getter-status');}catch{}
  }
  legacy=remaining;
  $('total').textContent=data.jobs.length;
  $('updated').textContent=data.updated_at?new Date(data.updated_at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Unknown';
  $('feedStatus').textContent=`${data.sources_ok.length} feeds refreshed${data.errors.length?` · ${data.errors.length} source errors; stale records labeled`:''}${data.invalid?` · ${data.invalid} invalid listing(s) skipped`:''}. Scheduled refresh daily; verify current availability at the employer.`;
 } catch {
  data={jobs:[]};$('total').textContent='—';$('updated').textContent='Unavailable';
  $('feedStatus').textContent='Could not load current listings. Your private pipeline remains available; open My pipeline to review saved snapshots.';
 }
 render();
})();
