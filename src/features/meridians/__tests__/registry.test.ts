import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRegistry,getAnchor} from '../registry';
const review={source:'reference',section:'ST36',checkedAt:'2026-10-15'};
const models=[{id:'male-v1',variant:'male' as const,sha256:'a'.repeat(64),sourceFile:'male.glb',previewFiles:{front:'f.png',side:'s.png',back:'b.png'}},{id:'female-v1',variant:'female' as const,sha256:'b'.repeat(64),sourceFile:'female.glb',previewFiles:{front:'f.png',side:'s.png',back:'b.png'}}];
const definition={knowledgeId:'point-zusanli',referenceCode:'ST36',meridianId:'meridian-stomach',sides:['left','right'] as const,locationText:'leg',review};
const anchors=models.flatMap(model=>(['left','right'] as const).map(side=>({knowledgeId:definition.knowledgeId,modelId:model.id,side,modelSha256:model.sha256,position:[side==='left'?.1:-.1,.5,.05] as const,outwardNormal:[0,0,1] as const,viewDirection:[0,0,1] as const,viewDistance:.5,review})));
test('complete per-model, per-side registry is accepted',()=>assert.deepEqual(validateRegistry(models,[definition],anchors,[]),[]));
test('stale model digests and duplicated side records are rejected',()=>{
 assert(validateRegistry(models,[definition],[{...anchors[0],modelSha256:'stale'},...anchors.slice(1)],[]).some(x=>x.includes('hash')));
 assert(validateRegistry(models,[definition],[...anchors,anchors[0]],[]).some(x=>x.includes('duplicate')));
});
test('missing female anchor is not substituted by the male model',()=>{
 const missing=anchors.filter(x=>!(x.modelId==='female-v1'&&x.side==='left'));
 assert(validateRegistry(models,[definition],missing,[]).some(x=>x.includes('missing')));
 assert.equal(getAnchor(missing,'female-v1',{knowledgeId:'point-zusanli',side:'left'}),null);
});
test('invalid vectors and midline duplicates are rejected',()=>{
 assert(validateRegistry(models,[definition],[{...anchors[0],position:[NaN,0,0],outwardNormal:[0,0,0]},...anchors.slice(1)],[]).some(x=>x.includes('vector')));
 assert(validateRegistry(models,[{...definition,sides:['midline']}],anchors,[]).some(x=>x.includes('side')));
});
