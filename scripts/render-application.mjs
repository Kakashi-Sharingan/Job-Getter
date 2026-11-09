import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createApplication,documentHTML} from '../docs/tailor.mjs';
import {createPDF,applicationBlocks} from '../docs/pdf.mjs';
const [candidateFile,jobFile,destination]=process.argv.slice(2);
if(!candidateFile||!jobFile||!destination)throw Error('Usage: node scripts/render-application.mjs <private-profile.json> <job.json> <private-output-dir>');
const app=createApplication(JSON.parse(readFileSync(candidateFile,'utf8')),JSON.parse(readFileSync(jobFile,'utf8')));
const out=resolve(destination);mkdirSync(out,{recursive:true});writeFileSync(join(out,'application.json'),JSON.stringify(app,null,2));
for(const kind of ['resume','cover','combined']){writeFileSync(join(out,`${kind}.html`),documentHTML(app,kind));writeFileSync(join(out,`${kind}.pdf`),createPDF(applicationBlocks(app,kind)));}
const files=Object.fromEntries(['resume.pdf','cover.pdf','combined.pdf','application.json'].map(file=>[file,createHash('sha256').update(readFileSync(join(out,file))).digest('hex')]));writeFileSync(join(out,'document-hashes.json'),JSON.stringify(files,null,2));console.log('Generated private resume, cover letter, combined PDF, source audit and hashes.');
