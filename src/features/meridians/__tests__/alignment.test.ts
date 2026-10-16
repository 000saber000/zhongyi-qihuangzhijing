import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const anchors=JSON.parse(readFileSync(new URL('../anchors.json',import.meta.url),'utf8'));
// Independently measured centerline dimples on the immutable exported v4 meshes,
// also visually checked on the textured 900px orthographic reference renders.
const measured={male:1.096,female:1.053};
test('Shenque and both Tianshu points sit on the visible umbilical level of each actual model',()=>{
 for(const [variant,umbilicusY] of Object.entries(measured)){
  const own=anchors.filter((a:any)=>a.modelId===`adult-${variant}-v4`);
  for(const point of own.filter((a:any)=>['point-shenque','point-tianshu'].includes(a.knowledgeId))){
   assert(Math.abs(point.position[1]-umbilicusY)<.004,`${variant} ${point.knowledgeId}:${point.side} is displaced from the umbilical plane`);
  }
 }
});
test('lower abdominal points use the umbilicus/pubic region, not a whole-body height ratio',()=>{
 const landmarks=JSON.parse(readFileSync(new URL('../../../assets/anatomy/surface-landmarks.json',import.meta.url),'utf8'));
 for(const variant of ['male','female']){
  const {umbilicusY,pubicSymphysisY}=landmarks[variant];
  const get=(id:string)=>anchors.find((a:any)=>a.modelId===`adult-${variant}-v4`&&a.knowledgeId===id).position[1];
  const qihai=get('point-qihai'),guanyuan=get('point-guanyuan');
  assert(umbilicusY>qihai&&qihai>guanyuan&&guanyuan>pubicSymphysisY);
  assert(Math.abs((umbilicusY-qihai)/(umbilicusY-pubicSymphysisY)-.3)<.02);
  assert(Math.abs((umbilicusY-guanyuan)/(umbilicusY-pubicSymphysisY)-.6)<.02);
 }
});
