import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=(file:string)=>JSON.parse(readFileSync(new URL('../../../assets/anatomy/'+file,import.meta.url),'utf8'));
test('each organ asset is baked for its exact body digest and independent of the other variant',()=>{
 const fit=read('organs.manifest.json'),bodies=read('models.manifest.json');
 assert.notEqual(fit.male.sourceFile,fit.female.sourceFile);
 assert.notEqual(fit.male.sha256,fit.female.sha256);
 for(const variant of ['male','female']){
  assert.equal(fit[variant].bodyModelId,bodies[variant].id);
  assert.equal(fit[variant].bodySha256,bodies[variant].sha256);
  const bytes=readFileSync(new URL('../../../assets/anatomy/'+fit[variant].sourceFile,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),fit[variant].sha256);
  assert(bytes.length<4000000);
 }
});
