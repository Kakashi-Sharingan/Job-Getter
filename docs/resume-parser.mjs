// Conservative parser for clearly labeled resumes. Original bullets remain verbatim.
export function parseResumeText(source){
 const lines=source.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const header=/^(professional summary|summary|profile|technical skills|skills|professional experience|work experience|experience|education)$/i;
 const sections={};let section='header';sections.header=[];
 for(const line of lines){if(header.test(line)){section=line.toLowerCase().includes('summary')||line.toLowerCase()==='profile'?'summary':line.toLowerCase().includes('skills')?'skills':line.toLowerCase().includes('experience')?'experience':'education';sections[section]??=[];}else (sections[section]??=[]).push(line);}
 if(!sections.experience?.length||!sections.skills?.length)throw Error('Could not identify Skills and Experience. Use a resume with clear section headings or a verified profile file.');
 const profile={version:1,name:sections.header[0],email:source.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0]||'',phone:source.match(/\+\d[\d ()-]{8,}\d/)?.[0]||'',linkedin:source.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s]+/)?.[0]||'',summary:(sections.summary||[]).join(' '),source_resume:source,skills:sections.skills,education:[],experience:[]};
 let company='',role=null;
 for(const [index,line] of sections.experience.entries()){
  const match=line.match(/^(.+?)\s*[|]\s*((?:[A-Za-z]{3,9}\s+)?\d{4}.*)$/);
  if(match){if(!company)throw Error('Employer name could not be identified');role={company,title:match[1].trim(),dates:match[2].trim(),achievements:[]};profile.experience.push(role);}
  else if(/^[-•]/.test(line)){if(!role)throw Error('Experience bullet has no role heading');const text=line.replace(/^[-•]\s*/,'');role.achievements.push({id:`source-${profile.experience.length}-${role.achievements.length+1}`,text,evidence:text,x:text.split(/\b(?:by|through|using)\b/i)[0].trim(),y:null,z:text.match(/\b(?:by|through|using)\s+(.+)/i)?.[1]||null,metric:null});}
  else if(sections.experience[index+1]?.match(/^(.+?)\s*[|]\s*((?:[A-Za-z]{3,9}\s+)?\d{4}.*)$/)){company=line;role=null;}
  else if(role&&role.achievements.length){const last=role.achievements.at(-1);last.text+=' '+line;last.evidence=last.text;}
  else company=line;
 }
 for(const line of sections.education||[]){const m=line.match(/^([^,]+),\s*(.+?)\s*\(([^)]+)\)\s*$/);if(m)profile.education.push({degree:m[1],institution:m[2],dates:m[3]});else if(/\d{4}/.test(line))throw Error('Education format needs review; expected Degree, Institution (dates).');}
 if(!profile.experience.length||profile.experience.some(r=>!r.achievements.length))throw Error('Work history format needs review; expected Title | dates and bullet points.');
 return profile;
}
export async function readResumeFile(file){
 if(file.name.toLowerCase().endsWith('.json'))return JSON.parse(await file.text());
 if(file.name.toLowerCase().endsWith('.txt'))return parseResumeText(await file.text());
 if(file.name.toLowerCase().endsWith('.pdf')){
  const pdfjs=await import('./vendor/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.min.mjs',import.meta.url).href;
  const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;const lines=[];
  for(let i=1;i<=pdf.numPages;i++){const content=await (await pdf.getPage(i)).getTextContent();let y=null,line='';for(const item of content.items){if(!('str' in item))continue;const current=Math.round(item.transform[5]);if(y!==null&&Math.abs(current-y)>3){lines.push(line);line='';}line+=(line?' ':'')+item.str;y=current;}if(line)lines.push(line);}
  await pdf.destroy();return parseResumeText(lines.join('\n'));
 }
 throw Error('Choose PDF, TXT, or a verified JSON profile.');
}
