import test from 'node:test';
import assert from 'node:assert/strict';
import * as display from '../state';
test('detail markers appear up close, when selected, or in a filtered/full directory',()=>{
 assert.equal(typeof display.markerIsVisible,'function','distance visibility rule is missing');
 const visible=display.markerIsVisible;
 assert.equal(visible(false,3,false),true);
 assert.equal(visible(true,3,false),false);
 assert.equal(visible(true,.7,false),true);
 assert.equal(visible(true,3,true),true);
});
test('xray starts with a limited preview and isolates the selected or filtered meridian',()=>{
 assert.equal(typeof display.networkMeridians,'function','contextual xray rule is missing');
 const ids=display.networkMeridians;
 assert(ids('all',undefined).length>0&&ids('all',undefined).length<14);
 assert.deepEqual(ids('all','meridian-bladder'),['meridian-bladder']);
 assert.deepEqual(ids('meridian-lung',undefined),['meridian-lung']);
 assert.deepEqual(ids('all',null),[],'an extra point must not acquire an invented meridian');
 assert.deepEqual(ids('extra',undefined),[]);
});
