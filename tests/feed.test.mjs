import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFeed} from '../docs/feed.mjs';
const job={id:'example:1',title:'Java engineer',company:'Example',location:'Unknown',url:'https://example.com/job/1',description:'Java'};
test('bad listings are isolated; optional metadata is normalized',()=>{
 const feed=parseFeed({jobs:[null,{...job,id:'bad',url:'javascript:alert(1)'},job],updated_at:'not a date'});
 assert.equal(feed.jobs.length,1);assert.equal(feed.invalid,2);
 assert.deepEqual(feed.jobs[0].matched_skills,[]);assert.deepEqual(feed.sources_ok,[]);assert.equal(feed.updated_at,null);
});
test('malformed top-level feed is rejected and duplicates are not shown twice',()=>{
 assert.throws(()=>parseFeed({jobs:null}));
 assert.equal(parseFeed({jobs:[job,job]}).jobs.length,1);
});
