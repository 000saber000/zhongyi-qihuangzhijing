// Read-only inspection of the actual exported geometry and preset sight lines.
// Run from repository root: node scripts/anatomy/verify-views.mjs
// Optional aspect ratios: append 1.2 0.72 0.45.
// This checks final sight lines, not anatomical accuracy or camera flight paths.
import fs from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Vector3,Raycaster} from 'three';

const aspects=process.argv.slice(2).map(Number);
if(!aspects.length)aspects.push(1.2,.72,.45);
if(aspects.some(a=>!Number.isFinite(a)||a<=0))throw new Error('Aspect ratios must be positive finite numbers.');
const anchors=JSON.parse(fs.readFileSync('src/features/meridians/anchors.json','utf8'));
const epsilon=1e-5; // 0.01 mm, only to absorb numerical rounding; markers sit 2.5 mm off the mesh.
let failures=0;
for(const variant of ['male','female']){
 const buffer=fs.readFileSync(`src/assets/anatomy/adult-${variant}-v2.glb`);
 const gltf=await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
 gltf.scene.updateMatrixWorld(true);
 const meshes=[];
 gltf.scene.traverse(object=>{if(object.isMesh)meshes.push(object);});
 for(const aspect of aspects){
  const blocked=[];
  const relevant=anchors.filter(anchor=>anchor.modelId===`adult-${variant}-v2`);
  for(const anchor of relevant){
   // Matches cameraPose()'s current narrow-viewport distance adjustment.
   const distance=anchor.viewDistance*Math.max(1,.72/Math.max(.15,aspect));
   const position=new Vector3(...anchor.position);
   const direction=new Vector3(...anchor.viewDirection).normalize();
   const camera=position.clone().addScaledVector(direction,distance);
   const ray=new Raycaster(camera,position.clone().sub(camera).normalize());
   const hits=ray.intersectObjects(meshes,false);
   const normalDot=new Vector3(...anchor.outwardNormal).dot(direction);
   if((hits[0]&&hits[0].distance<distance-epsilon)||normalDot<=0){
    blocked.push({id:anchor.knowledgeId,side:anchor.side,firstBodyDistance:hits[0]?.distance??null,markerDistance:distance,normalDot,camera:camera.toArray()});
   }
  }
  failures+=blocked.length;
  console.log(JSON.stringify({variant,aspect,checked:relevant.length,epsilon,blocked},null,2));
 }
}
process.exitCode=failures?1:0;
