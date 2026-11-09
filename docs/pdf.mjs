import {regular,bold} from './vendor/liberation-fonts.mjs';
import {jsPDF} from './vendor/jspdf.bundle.mjs';
export function applicationBlocks(app,kind='resume'){
 const p=app.resume,contact=[p.email,p.phone,p.linkedin].filter(Boolean).join(' | ');
 const resume=[{text:p.name,size:20,bold:true},{text:contact,size:9},{text:'PROFESSIONAL SUMMARY',bold:true,gap:10},{text:p.summary},{text:'TECHNICAL SKILLS',bold:true,gap:10},{text:p.skills.join(' | ')},{text:'PROFESSIONAL EXPERIENCE',bold:true,gap:10}];
 for(const role of p.experience){resume.push({text:`${role.title} | ${role.company}`,bold:true,gap:7},{text:role.dates,size:9});for(const a of role.achievements)resume.push({text:'- '+a.text});}
 resume.push({text:'EDUCATION',bold:true,gap:10});for(const e of p.education)resume.push({text:`${e.degree} | ${e.institution} | ${e.dates}`});
 const cover=[{text:p.name,size:20,bold:true},{text:contact,size:9},{text:`${app.target.title} | ${app.target.company}`,bold:true,gap:12},...app.cover_letter.split('\n\n').map(text=>({text,gap:8}))];
 return kind==='cover'?cover:kind==='combined'?[...resume,{pagebreak:true},...cover]:resume;
}
export function createPDF(blocks){
 const doc=new jsPDF({unit:'pt',format:'letter',compress:true});let y=48;
 doc.addFileToVFS('LiberationSans-Regular.ttf',regular);doc.addFont('LiberationSans-Regular.ttf','LiberationSans','normal');
 doc.addFileToVFS('LiberationSans-Bold.ttf',bold);doc.addFont('LiberationSans-Bold.ttf','LiberationSans','bold');
 for(const block of blocks){
  if(block.pagebreak){doc.addPage();y=48;continue;}
  const size=block.size||10,leading=size*1.4;
  doc.setFont('LiberationSans',block.bold?'bold':'normal');doc.setFontSize(size);
  y+=block.gap||3;
  const text=String(block.text??'').replace(/[–—]/g,'-').replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/·/g,' | ');
  for(const line of doc.splitTextToSize(text,516)){
   if(y+leading>744){doc.addPage();y=48;}
   doc.text(line,48,y);y+=leading;
  }
 }
 return new Uint8Array(doc.output('arraybuffer'));
}
