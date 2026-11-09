// Approval-bound application worker. No submissions run on import.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function verifyManifest(file,approval){
 const bytes=fs.readFileSync(file),digest=hash(bytes),manifest=JSON.parse(bytes);
 if(!approval||approval!==digest)throw Error('Exact application manifest approval is required');
 if(manifest.version!==1||manifest.job_url!=='https://job-boards.greenhouse.io/hootsuite/jobs/8359647')throw Error('This adapter supports only the reviewed Hootsuite requisition');
 if(manifest.blockers?.length)throw Error('Required answers remain unresolved');
 if(manifest.privacy_acknowledgement!==true)throw Error('Privacy acknowledgement must be included in the reviewed approval');
 for(const [name,expected] of Object.entries(manifest.document_hashes||{})){const full=path.resolve(path.dirname(file),name);if(!full.startsWith(path.dirname(path.resolve(file))+path.sep))throw Error('Document outside application package');if(hash(fs.readFileSync(full))!==expected)throw Error('A document changed after review');}
 if(!manifest.document_hashes?.['combined.pdf'])throw Error('Reviewed attachment hash missing');
 if(!Array.isArray(manifest.actions)||!manifest.actions.length)throw Error('Reviewed form actions missing');
 return {manifest,digest};
}
async function fillReviewedForm(page,manifest,base){
 for(const action of manifest.actions){
  if(typeof action.selector!=='string'||!action.selector.startsWith('#'))throw Error('Invalid field selector');
  const field=page.locator(action.selector);
  if(action.kind==='text')await field.fill(action.value);
  else if(action.kind==='select'){
   await field.fill(action.search||'');await field.press('ArrowDown');
   await page.getByRole('option',{name:action.value,exact:true}).click();
  } else if(action.kind==='location'){
   await field.fill(action.value);await field.press('ArrowDown');
   const options=page.getByRole('option');
   await options.first().waitFor({timeout:10000});
   const option=page.getByRole('option',{name:/^Vancouver,\s*(British Columbia|BC),\s*Canada$/i});
   if(await option.count()!==1)throw Error('Current city needs manual verification');
   await option.click();
  } else if(action.kind==='file'){
   if(action.value!=='combined.pdf')throw Error('Unreviewed attachment');
   await field.setInputFiles(path.resolve(base,action.value));
  } else throw Error('Unsupported field action');
 }
}
async function confirmSubmission(page){
 await page.getByRole('button',{name:'Submit application',exact:true}).click();
 await page.getByRole('heading').filter({hasText:/thank you for (applying|your application)|application (has been |was )?submitted|application received/i}).first().waitFor({timeout:30000});
 return {confirmation_url:page.url(),confirmation_text:(await page.locator('body').innerText()).slice(0,6000)};
}
async function run(file,approval){
 const {manifest,digest}=verifyManifest(file,approval),base=path.dirname(path.resolve(file));
 const receipt=path.join(base,'receipt.json'),attempt=path.join(base,'attempt.json');
 if(fs.existsSync(receipt))throw Error('A prior receipt exists; do not duplicate the application');
 if(fs.existsSync(attempt))throw Error('An earlier submission attempt exists. Verify its outcome before any retry.');
 const {chromium}=require('playwright');
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage();let attempted=false;
 try{
  const expected=JSON.parse(fs.readFileSync(path.join(base,'application.json'),'utf8'));
  const api=await page.goto('https://boards-api.greenhouse.io/v1/boards/hootsuite/jobs/8359647',{waitUntil:'domcontentloaded',timeout:30000});
  if(!api||api.status()!==200)throw Error('Employer API cannot confirm the current posting');
  const current=JSON.parse(await page.locator('body').innerText());
  const description=current.content.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
  if(hash(description)!==expected.job_snapshot.content_hash)throw Error('Posting changed after review; regenerate and approve the updated application');
  await page.goto(manifest.job_url,{waitUntil:'networkidle',timeout:45000});
  if(await page.getByRole('heading',{name:'Junior Software Developer',exact:true}).count()===0)throw Error('Posting title/liveness needs review');
  await fillReviewedForm(page,manifest,base);
  await page.screenshot({path:path.join(base,'filled-form.png'),fullPage:true});
  // Fail on visible field errors before attempting a submission.
  const errors=page.locator('[aria-invalid="true"]');if(await errors.count())throw Error('Employer form reports invalid fields');
  fs.writeFileSync(attempt,JSON.stringify({manifest_sha256:digest,attempted_at:new Date().toISOString(),status:'submission_pending'},null,2),{flag:'wx'});
  attempted=true;
  let confirmation;
  try{
   confirmation=await confirmSubmission(page);
  }catch{
   await page.screenshot({path:path.join(base,'submission-needs-review.png'),fullPage:true});
   fs.writeFileSync(attempt,JSON.stringify({manifest_sha256:digest,status:'submission_unknown',reason:'No confirmed employer receipt; inspect page. Do not retry blindly.'},null,2));
   throw Error('Submission not confirmed. A challenge or validation issue may require manual completion. No automatic retry.');
  }
  const result={status:'submitted',job_url:manifest.job_url,...confirmation,manifest_sha256:digest,submitted_at:new Date().toISOString()};
  fs.writeFileSync(receipt,JSON.stringify(result,null,2));await page.screenshot({path:path.join(base,'confirmation.png'),fullPage:true});console.log('Confirmed employer receipt saved privately.');
 }catch(error){console.error(error.message);if(!attempted)console.error('Stopped before the final submission click.');process.exitCode=1;}
 finally{await browser.close();}
}
module.exports={verifyManifest,fillReviewedForm,confirmSubmission};
if(require.main===module){const args=process.argv.slice(2),file=args[0],pos=args.indexOf('--approved-sha256');if(!file||pos<0){console.error('Usage: node scripts/greenhouse-worker.cjs <private-manifest.json> --approved-sha256 <reviewed-hash>');process.exitCode=1;}else run(file,args[pos+1]).catch(e=>{console.error(e.message);process.exitCode=1;});}
