import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {definitions,anchors,models,registryProblems} from '../data';
test('all 20 point kinds have independent surfaces for both model files and their exact digest',()=>{
 assert.deepEqual(registryProblems,[]);assert.equal(definitions.length,20);assert.equal(anchors.length,68);
 for(const model of models){
  const bytes=readFileSync(new URL('../../../assets/anatomy/'+model.sourceFile,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),model.sha256);
  const records=anchors.filter(a=>a.modelId===model.id);assert.equal(records.length,34);
 }
 for(const definition of definitions){
  const male=anchors.filter(a=>a.modelId===models[0].id&&a.knowledgeId===definition.knowledgeId);
  const female=anchors.filter(a=>a.modelId===models[1].id&&a.knowledgeId===definition.knowledgeId);
  assert.notDeepEqual(male.map(a=>a.position),female.map(a=>a.position));
 }
});
