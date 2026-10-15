import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import anchors from '../anchors.json';
import {cameraPose,interpolateOrbit,nearestVisibleMarker} from '../camera';
import type {AcupointAnchor} from '../types';
test('chest focus leaves headroom for both models in wide and narrow viewers',()=>{
 for(const [variant,height] of [['male',1.78],['female',1.70]] as const){
  const anchor=anchors.find(a=>a.modelId===`adult-${variant}-v4`&&a.knowledgeId==='point-shanzhong') as AcupointAnchor;
  for(const aspect of [1.5,1,.45]){
   const pose=cameraPose(anchor,aspect,height),camera=new PerspectiveCamera(45,aspect,.01,30);
   camera.position.fromArray(pose.position);camera.lookAt(...pose.target);camera.updateMatrixWorld();
   const scalp=new Vector3(0,height,0).project(camera);
   assert.ok(scalp.y<.92&&scalp.y>-.92,`${variant} scalp is clipped at aspect ${aspect}: ${scalp.y}`);
   assert.deepEqual(pose.target,anchor.position);
  }
 }
});
test('point view accounts for the narrow viewport, foot sole and back direction',()=>{
 const a={position:[.2,.01,.12],viewDirection:[0,-1,.15],viewDistance:.38} as AcupointAnchor;
 const wide=cameraPose(a,1.2),narrow=cameraPose(a,.45);
 assert.ok(wide.position[1]<a.position[1]);
 assert.ok(Math.hypot(...narrow.position.map((x,i)=>x-a.position[i]))>Math.hypot(...wide.position.map((x,i)=>x-a.position[i])));
});
test('opposite views travel around the body and settle at exact requested pose',()=>{
 const start={position:[0,.9,3] as const,target:[0,.9,0] as const},end={position:[0,.9,-3] as const,target:[0,.9,0] as const};
 const middle=interpolateOrbit(start,end,.5);
 assert.ok(Math.hypot(middle.position[0],middle.position[2])>2.99);
 assert.deepEqual(interpolateOrbit(start,end,1),end);
});
test('body intersection in front blocks a marker while nearest visible marker is selectable',()=>{
 assert.equal(nearestVisibleMarker([{kind:'body',distance:1},{kind:'marker',distance:1.1,id:'hidden'}]),null);
 assert.equal(nearestVisibleMarker([{kind:'marker',distance:.9,id:'near'},{kind:'marker',distance:1.1,id:'far'},{kind:'body',distance:1}]),'near');
});
