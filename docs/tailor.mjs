import {normalize} from './search.mjs';
const plain=s=>String(s||'').replace(/\s+/g,' ').trim();
const numbers=s=>String(s).match(/\d+(?:[.,]\d+)?%?/g)||[];
function verifiedText(text,source){for(const n of numbers(text))if(!numbers(source).includes(n))throw Error(`Unsupported number in resume claim: ${n}`);}
export function validateProfile(profile){
 if(!profile||profile.version!==1||!profile.name||!profile.source_resume||!Array.isArray(profile.experience)||!Array.isArray(profile.skills)||!Array.isArray(profile.education))throw Error('Import a valid verified resume profile');
 if(profile.source_resume.length>100000)throw Error('Resume profile is too large');
 verifiedText(profile.summary||'',profile.source_resume);verifiedText(profile.cover_summary||'',profile.source_resume);
 for(const role of profile.experience){
  if(!role.company||!role.title||!role.dates||!Array.isArray(role.achievements))throw Error('Incomplete employment history');
  for(const a of role.achievements){if(!a.id||!a.evidence||!plain(profile.source_resume).includes(plain(a.evidence)))throw Error('An achievement lacks matching source evidence');verifiedText(a.text||'',a.evidence);if(a.metric&&!plain(a.evidence).includes(plain(a.metric)))throw Error('A metric is not supported by its cited source');}
 }
 for(const skill of profile.skills)if(!normalize(profile.source_resume).includes(normalize(skill)))throw Error(`Skill is not in the source resume: ${skill}`);
 return profile;
}
function relevance(text,job){const words=new Set(normalize(`${job.title} ${job.description}`).split(' '));return normalize(text).split(' ').filter(w=>w.length>3&&words.has(w)).length;}
export function createApplication(input,job){
 const profile=validateProfile(input);
 const experience=profile.experience.map(role=>({...role,achievements:[...role.achievements].sort((a,b)=>relevance(b.text,job)-relevance(a.text,job))}));
 const jd=normalize(`${job.title} ${job.description}`);
 const skills=[...profile.skills].sort((a,b)=>Number(jd.includes(normalize(b)))-Number(jd.includes(normalize(a))));
 const achievements=experience.flatMap(r=>r.achievements.map(a=>({...a,company:r.company}))).sort((a,b)=>relevance(b.text,job)-relevance(a.text,job));
 const first=achievements[0],second=achievements.find(a=>a.id!==first?.id);
 const evidenceParagraph=[first,second].filter(Boolean).map(a=>`At ${a.company}, I ${a.text.charAt(0).toLowerCase()+a.text.slice(1)}`).join(' ');
 const aligned=skills.filter(skill=>jd.includes(normalize(skill))).slice(0,3);
 const connection=aligned.length?`The posting's focus on ${aligned.join(', ')} connects directly with the skills in my background. `:'';
 const coverLetter=`Dear ${job.company} Hiring Team,\n\nI am applying for the ${job.title} position. ${profile.cover_summary||profile.summary}\n\n${connection}${evidenceParagraph}\n\nI would welcome the opportunity to discuss how I could contribute to your team. Thank you for considering my application.\n\nSincerely,\n${profile.name}`;
 return {version:1,status:'draft_not_submitted',method:'Source-based tailoring; no AI API',target:{id:job.id,title:job.title,company:job.company,url:job.url,content_hash:job.content_hash},resume:{...profile,skills,experience},cover_letter:coverLetter,xyz_audit:achievements.map(a=>({id:a.id,x:a.x||null,y:a.y||null,z:a.z||null,metric:a.metric||null,evidence:a.evidence,note:a.metric?'Metric cited in source':'No quantitative metric supplied; qualitative outcome retained'})),job_snapshot:job,created_at:new Date().toISOString()};
}
export function documentHTML(application,kind='resume'){
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const p=application.resume;
 const resume=`<h1>${esc(p.name)}</h1><p class="contact">${[p.email,p.phone,p.linkedin].filter(Boolean).map(esc).join(' · ')}</p><h2>Professional summary</h2><p>${esc(p.summary)}</p><h2>Technical skills</h2><p>${p.skills.map(esc).join(' · ')}</p><h2>Professional experience</h2>${p.experience.map(r=>`<section><h3>${esc(r.title)} · ${esc(r.company)}</h3><p class="dates">${esc(r.dates)}</p><ul>${r.achievements.map(a=>`<li>${esc(a.text)}</li>`).join('')}</ul></section>`).join('')}<h2>Education</h2>${p.education.map(e=>`<p>${esc(e.degree)} · ${esc(e.institution)} · ${esc(e.dates)}</p>`).join('')}`;
 const letter=`<h1>${esc(p.name)}</h1><p class="contact">${[p.email,p.phone].filter(Boolean).map(esc).join(' · ')}</p><h2>${esc(application.target.title)} · ${esc(application.target.company)}</h2>${application.cover_letter.split('\n\n').map(t=>`<p>${esc(t).replace(/\n/g,'<br>')}</p>`).join('')}`;
 const content=kind==='cover'?letter:kind==='combined'?`${resume}<div class="pagebreak"></div>${letter}`:resume;
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(p.name)} · ${kind==='cover'?'Cover letter':'Application'}</title><style>@page{size:Letter;margin:15mm 16mm}body{font:10pt/1.4 Arial,sans-serif;color:#162725;max-width:760px;margin:24px auto}h1{font-size:21pt;margin:0 0 4px}h2{font-size:11pt;text-transform:uppercase;letter-spacing:.8px;margin:16px 0 6px;border-bottom:1px solid #c8d5d0;padding-bottom:4px}h3{font-size:10pt;margin:10px 0 2px}p{margin:5px 0 10px}.contact,.dates{font-size:9pt;color:#42544c}ul{padding-left:18px;margin:5px 0}li{margin:0 0 5px;break-inside:avoid}.pagebreak{break-before:page}section{break-inside:auto}@media print{body{margin:0;max-width:none}}</style></head><body>${content}</body></html>`;
}
