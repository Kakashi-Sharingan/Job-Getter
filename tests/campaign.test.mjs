import test from 'node:test';import assert from 'node:assert/strict';
import {dailyProgress} from '../docs/campaign.mjs';
const job={id:'example:1',title:'Software Engineer',company:'Example',location:'Canada',description:'Java',url:'https://example.com/jobs/1'};
test('a new day resets progress while preserving lifetime submissions and rejection history',()=>{
 const record={status:'Rejected',event_date:'2026-11-13',job,application_snapshot:job,history:[{to:'Applied',event_date:'2026-11-12'},{to:'Rejected',event_date:'2026-11-13'}]};
 assert.deepEqual(dailyProgress({one:record},50,'2026-11-13'),{date:'2026-11-13',applied:0,target:50,remaining:50,lifetime:1});
 assert.equal(dailyProgress({one:record},50,'2026-11-12').applied,1);
 assert.equal(record.history.length,2);
});
test('only real submissions count and later outcomes never count as a second application',()=>{
 const saved={job,status:'Prepared',event_date:'2026-11-13',history:[]};
 const sent={job,status:'Applied',event_date:'2026-11-13',application_snapshot:job,history:[{to:'Applied',event_date:'2026-11-13'},{to:'Applied',event_date:'2026-11-14'}]};
 assert.equal(dailyProgress({saved,sent},50,'2026-11-13').applied,1);
 assert.equal(dailyProgress({saved,sent},50,'2026-11-14').applied,0);
});
