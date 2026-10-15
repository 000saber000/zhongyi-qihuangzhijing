import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateRegistry} from '../registry';
const read=(name:string)=>JSON.parse(readFileSync(new URL('../'+name,import.meta.url),'utf8'));
const points=read('acupoints.json'),anchors=read('anchors.json'),models=read('models.json'),paths=read('paths.json');
const knowledge=JSON.parse(readFileSync(new URL('../../../data/knowledge.json',import.meta.url),'utf8'));
test('expanded directory contains sixty sourced points covering all fourteen meridians',()=>{
 assert.equal(points.length,60);
 assert.equal(new Set(points.filter((p:any)=>p.meridianId).map((p:any)=>p.meridianId)).size,14);
 assert.equal(new Set(points.map((p:any)=>p.referenceCode)).size,60);
 for(const point of points){
  const entry=knowledge.find((k:any)=>k.id===point.knowledgeId);
  assert(entry,point.knowledgeId+' needs published seed knowledge');
  assert(point.locationText.length>8,point.referenceCode+' needs a location');
  assert.match(point.review.source,/^https:\/\//);
  assert(entry.relations.includes(point.meridianId)||point.meridianId===null);
 }
});
test('every expanded point has independent hash-bound model anchors on every declared side',()=>{
 assert.deepEqual(validateRegistry(models,points,anchors,paths),[]);
 for(const point of points)for(const model of models)for(const side of point.sides){
  assert.equal(anchors.filter((a:any)=>a.knowledgeId===point.knowledgeId&&a.modelId===model.id&&a.side===side).length,1);
 }
});
test('distinct point centers do not collapse onto the same model surface location',()=>{
 for(const model of models){
  const own=anchors.filter((a:any)=>a.modelId===model.id);
  for(let i=0;i<own.length;i++)for(const other of own.slice(i+1)){
   const point=own[i],distance=Math.hypot(...point.position.map((value:number,index:number)=>value-other.position[index]));
   assert(distance>.006,`${model.id}: ${point.knowledgeId}:${point.side} overlaps ${other.knowledgeId}:${other.side} at ${distance}m`);
  }
 }
});
