'use strict';
const assetBase=new URL('.',document.currentScript.src);
const $=id=>document.getElementById(id);
let data={jobs:[]}, onlySaved=false, current=null, state={};
try {state=JSON.parse(localStorage.getItem('job-getter-status')||'{}');if(!state||typeof state!=='object'||Array.isArray(state))state={};}catch{}
function persist(){try{localStorage.setItem('job-getter-status',JSON.stringify(state));}catch{$('feedStatus').textContent='Browser storage unavailable; decisions will last for this visit only.';}}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function validURL(value){try {const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
function render(){
 const q=$('query').value.toLowerCase(),loc=$('location').value.toLowerCase(),limit=Number($('threshold').value);
 const jobs=data.jobs.filter(j=>j.score>=limit&&(!onlySaved||state[j.id])&&`${j.title} ${j.company} ${j.description}`.toLowerCase().includes(q)&&j.location.toLowerCase().includes(loc));
 $('jobs').replaceChildren();$('count').textContent=jobs.length;$('saved').textContent=data.jobs.filter(j=>state[j.id]).length;$('strong').textContent=data.jobs.filter(j=>j.score>=limit).length;
 $('allNav').classList.toggle('active',!onlySaved);$('savedNav').classList.toggle('active',onlySaved);
 $('listTitle').firstChild.textContent=onlySaved?'Saved & reviewed ':'Your opportunities ';
 if(!jobs.length)$('jobs').append(el('div','empty','No matching roles. Try a lower threshold or another location.'));
 for(const j of jobs){
  const card=el('article','job'),avatar=el('div','avatar',j.company[0].toUpperCase()),body=el('div'),right=el('div','right');
  body.append(el('div','company',j.company),el('h3','',j.title),el('div','meta',`${j.location} · ${j.source}${j.stale?' · Feed stale':''}`));
  const tags=el('div','tags');for(const s of j.matched_skills.slice(0,6))tags.append(el('span','tag',s));body.append(tags);
  right.append(el('div','score',`${j.score}% keyword fit`));const buttons=el('div','job-buttons'),save=el('button','',state[j.id]?'♥ Saved':'♡ Save'),view=el('button','primary','Review role ↗');
  save.setAttribute('aria-label',`Save ${j.title} at ${j.company}`);save.onclick=()=>{if(state[j.id])delete state[j.id];else state[j.id]='saved';persist();render();};view.onclick=()=>openJob(j);buttons.append(save,view);right.append(buttons);card.append(avatar,body,right);$('jobs').append(card);
 }
}
function openJob(j){current=j;$('detailTitle').textContent=j.title;$('detailMeta').textContent=`${j.company} · ${j.location} · ${j.score}% keyword fit`;$('description').textContent=j.description;$('detailSkills').replaceChildren(...j.matched_skills.map(s=>el('span','tag',s)));const url=validURL(j.url);$('applyLink').hidden=!url;if(url)$('applyLink').href=url;$('reviewButton').textContent=state[j.id]==='reviewed'?'Reviewed in this browser ✓':'Mark reviewed locally';$('exportStatus').textContent='';$('detail').showModal();}
$('close').onclick=()=>{$('detail').close();$('resume').value='';};$('detail').addEventListener('close',()=>{$('resume').value='';});
$('reviewButton').onclick=()=>{if(!current)return;state[current.id]='reviewed';persist();$('reviewButton').textContent='Reviewed in this browser ✓';render();};
$('export').onclick=async()=>{
 if(!current)return;const resume=$('resume').value.trim();if(!resume){$('exportStatus').textContent='Paste your resume text first.';return;}
 const j=current;
 // Deliberately omit skills/experience claims in a deterministic draft.
 const letter=`Dear Hiring Team,\n\nI am applying for the ${j.title} position at ${j.company}. Please find my resume below for your consideration.\n\n[Before sending: add a specific example from your real experience that addresses an important requirement in this posting.]\n\nI would welcome the opportunity to discuss the role and how my background relates to your team's needs. Thank you for considering my application.\n\nSincerely,\n[Your name]`;
 const packageData={job_id:j.id,job_url:j.url,job_content_hash:j.content_hash,prepared_at:new Date().toISOString(),status:'draft_not_submitted',resume_original:resume,cover_letter_draft:letter,checks_required:['Location and work authorization','Every claim and required answer','Replace cover-letter placeholders','Check posting remains open'],note:'A local review package is not server-side submission approval.'};
 const content=JSON.stringify(packageData,null,2);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content)))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const blob=new Blob([JSON.stringify({...packageData,content_sha256:hash},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`application-${j.company}-${j.id.split(':').pop()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('exportStatus').textContent='Downloaded a draft review package. Nothing was sent or submitted.';
};
for(const id of ['query','location','threshold'])$(id).addEventListener('input',render);
$('allNav').onclick=()=>{onlySaved=false;render();};$('savedNav').onclick=()=>{onlySaved=true;render();};
(async()=>{try{const response=await fetch(new URL('data/jobs.json',assetBase),{cache:'no-cache'});if(!response.ok)throw Error(`HTTP ${response.status}`);data=await response.json();$('total').textContent=data.jobs.length;$('updated').textContent=new Date(data.updated_at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});$('feedStatus').textContent=`${data.sources_ok.length} feeds refreshed${data.errors.length?` · ${data.errors.length} source errors; stale records labeled`:''}. Scheduled refresh daily; GitHub may delay scheduled runs.`;render();}catch(error){$('updated').textContent='Unavailable';$('feedStatus').textContent='Could not load job listings. Please reload or check the refresh workflow.';$('jobs').append(el('div','empty','The feed is unavailable. Your saved decisions remain in your browser.'));}})();
