import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,reduceBodyState,readVariant,visiblePoints} from '../state';
import type {AcupointDefinition} from '../types';
test('switching model keeps selection and rejects stale completion, including a retry of same variant',()=>{
 let s=reduceBodyState(initialState('male'),{type:'select',selection:{knowledgeId:'point-zusanli',side:'right'}});
 s=reduceBodyState(s,{type:'request',variant:'female'});const older=s.requestId;
 s=reduceBodyState(s,{type:'request',variant:'male'});
 assert.equal(reduceBodyState(s,{type:'ready',requestId:older}).status,'loading');
 assert.deepEqual(s.selection,{knowledgeId:'point-zusanli',side:'right'});
 s=reduceBodyState(s,{type:'failed',requestId:s.requestId});assert.equal(s.status,'error');
 const previous=s.requestId;s=reduceBodyState(s,{type:'request',variant:'male'});
 assert.equal(reduceBodyState(s,{type:'ready',requestId:previous}).status,'loading');
 assert.equal(reduceBodyState(s,{type:'ready',requestId:s.requestId}).status,'ready');
});
test('only published points appear; search and meridian filter do not invent missing points',()=>{
 const defs=[{knowledgeId:'one',referenceCode:'ST36',meridianId:'stomach'},{knowledgeId:'removed',referenceCode:'LI4',meridianId:'largeintestine'}] as AcupointDefinition[];
 const items=[{id:'one',title:'足三里',subtitle:'',tags:['腿'],summary:''}] as any;
 assert.equal(visiblePoints(defs,items,'stomach','st36').length,1);
 assert.equal(visiblePoints(defs,items,'largeintestine','').length,0);
 assert.equal(visiblePoints(defs,items,'all','不存在').length,0);
});
test('preference validation handles absent, broken and blocked browser storage',()=>{
 assert.equal(readVariant({getItem:()=> 'female'}),'female');
 assert.equal(readVariant({getItem:()=> 'unsupported'}),'male');
 assert.equal(readVariant({getItem:()=>{throw Error('blocked');}}),'male');
});
test('failed or pending switch keeps the previously successful model',()=>{
 let s=initialState('male');s=reduceBodyState(s,{type:'ready',requestId:s.requestId});
 s=reduceBodyState(s,{type:'request',variant:'female'});assert.equal(s.displayedVariant,'male');
 s=reduceBodyState(s,{type:'failed',requestId:s.requestId});assert.equal(s.displayedVariant,'male');
 s=reduceBodyState(s,{type:'request',variant:'female'});s=reduceBodyState(s,{type:'ready',requestId:s.requestId});assert.equal(s.displayedVariant,'female');
});
