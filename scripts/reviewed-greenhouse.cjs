// Executes one reviewed package. No employer actions occur on import.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function verify(file,digest){
 const bytes=fs.readFileSync(file),m=JSON.parse(bytes),base=path.dirname(path.resolve(file));
 if(sha(bytes)!==digest||m.version!==1||m.approved!==true)throw Error('Exact reviewed manifest approval required');
 const u=new URL(m.url),match=u.pathname.match(/^\/([a-z0-9-]+)\/jobs\/(\d+)$/i);
 if(u.origin!=='https://job-boards.greenhouse.io'||!match)throw Error('Invalid employer identity');
 if(m.blockers?.length||!m.actions?.length)throw Error('Unresolved application');
 for(const a of m.actions){if(!/^#[a-zA-Z0-9_-]+$/.test(a.selector)||!['text','select','location','file'].includes(a.kind))throw Error('Invalid reviewed action');if(a.kind==='file'&&!m.files?.[a.value])throw Error('Unreviewed file');}
 for(const [name,h] of Object.entries(m.files||{})){if(!['resume.pdf','cover.pdf','combined.pdf'].includes(name)||sha(fs.readFileSync(path.join(base,name)))!==h)throw Error('Reviewed document changed');}
 return {m,base,board:match[1],id:match[2]};
}
async function select(page,a){
 const field=page.locator(a.selector);await field.fill(a.search??a.value);await field.press('ArrowDown');
 await page.getByRole('option').first().waitFor({timeout:15000});
 const option=a.selector==='#country'&&a.value==='Canada'?page.getByRole('option',{name:/^Canada(?:\s|\+|\(|$)/}):page.getByRole('option',{name:a.value,exact:true});
 if(await option.count()!==1)throw Error(`Reviewed option unavailable: ${a.selector} / ${a.value}`);
 await option.click();
}
async function waitForEmployerReceipt(page,board,id,timeout=30000){
  await page.waitForURL(u=>u.origin==='https://job-boards.greenhouse.io'&&u.pathname===`/${board}/jobs/${id}/confirmation`,{timeout});
  await page.locator('body').filter({hasText:/thank you for applying|thanks for applying[\s\S]*your application has been received|application sent!|application (has been |was )?(successfully )?submitted/i}).waitFor({timeout});
}
async function execute(file,digest,{dryRun=false}={}){
 const {m,base,board,id}=verify(file,digest),attempt=path.join(base,'attempt.json'),receipt=path.join(base,'receipt.json');
 if(fs.existsSync(attempt)||fs.existsSync(receipt))throw Error('Existing attempt or receipt; reconcile before retry');
 const {chromium}=require('playwright'),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();let clicked=false;
 const network=[];
 page.on('response',r=>{if(r.request().method()==='POST')network.push({host:new URL(r.url()).hostname,status:r.status()});});
 page.on('requestfailed',r=>network.push({host:new URL(r.url()).hostname,error:r.failure()?.errorText}));
 try{
  const response=await page.goto(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}?questions=true`,{waitUntil:'domcontentloaded',timeout:30000});
  if(response?.status()!==200)throw Error(`Posting unavailable (${response?.status()})`);const current=JSON.parse(await page.locator('body').innerText());
  if(current.title!==m.title||sha(JSON.stringify(current.questions||[]))!==m.questions_sha256||sha(current.content)!==m.content_sha256)throw Error('Posting or questions changed after review');
  await page.goto(m.url,{waitUntil:'networkidle',timeout:45000});await page.locator('#first_name').waitFor();
  for(const a of m.actions){
   const field=page.locator(a.selector);
   if(a.kind==='text')await field.fill(a.value);
   else if(a.kind==='select')await select(page,a);
   else if(a.kind==='location'){
    await field.fill(a.value);await field.press('ArrowDown');const option=page.getByRole('option',{name:new RegExp('^'+a.value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+',\\s*(British Columbia|BC),\\s*Canada$','i')});await option.waitFor({timeout:15000});await option.click();
   }else{
    const upload=page.waitForResponse(r=>r.request().method()==='POST'&&/^grnhse-prod-[a-z0-9-]+\.s3(?:\.[a-z0-9-]+)?\.amazonaws\.com$/.test(new URL(r.url()).hostname),{timeout:45000});
    await field.setInputFiles(path.join(base,a.value));const result=await upload;if(!result.ok())throw Error('Attachment upload rejected');await field.waitFor({state:'detached',timeout:20000});
   }
  }
  await page.screenshot({path:path.join(base,'reviewed-filled-form.png'),fullPage:true});
  const invalid=await page.locator('[aria-invalid="true"]').count();if(invalid)throw Error('Invalid fields before submission');
  if(dryRun)return {status:'filled_not_submitted'};
  const btn=page.getByRole('button',{name:'Submit application',exact:true});if(await btn.count()!==1)throw Error('Submission control needs review');
  fs.writeFileSync(attempt,JSON.stringify({status:'submission_pending',job_id:m.job_id,manifest_sha256:digest,attempted_at:new Date().toISOString()},null,2),{flag:'wx'});clicked=true;
  await btn.click();
  await waitForEmployerReceipt(page,board,id);
  const body=await page.locator('body').innerText();
  const result={status:'submitted',job_id:m.job_id,job_url:m.url,confirmation_url:page.url(),confirmation_text:body.slice(0,6000),submitted_at:new Date().toISOString(),manifest_sha256:digest};
  fs.writeFileSync(receipt,JSON.stringify(result,null,2));await page.screenshot({path:path.join(base,'confirmation.png'),fullPage:true});return result;
 }catch(e){
  fs.writeFileSync(path.join(base,'network-outcome.json'),JSON.stringify(network,null,2));const body=await page.locator('body').innerText().catch(()=> '');fs.writeFileSync(path.join(base,'worker-error.txt'),body);await page.screenshot({path:path.join(base,'worker-error.png'),fullPage:true}).catch(()=>{});
  if(clicked)fs.writeFileSync(attempt,JSON.stringify({status:'submission_unknown',manifest_sha256:digest,reason:e.message},null,2));
  throw Error(`${clicked?'Outcome unconfirmed; do not retry':'Stopped before submission'}: ${e.message}`);
 }finally{await browser.close();}
}
module.exports={verify,execute,waitForEmployerReceipt};
if(require.main===module){const [file,digest,...flags]=process.argv.slice(2);execute(file,digest,{dryRun:flags.includes('--dry-run')}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});}
