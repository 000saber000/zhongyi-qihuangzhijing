// Read-only inspection of the actual exported geometry and preset sight lines.
// Run from repository root: node scripts/anatomy/verify-views.mjs
// Optional aspect ratios: append 1.2 0.72 0.45.
// This checks final sight lines, not anatomical accuracy or camera flight paths.
import fs from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Vector3,Raycaster} from 'three';
import {cameraPose} from '../../src/features/meridians/camera.ts';

const aspects=process.argv.slice(2).map(Number);
if(!aspects.length)aspects.push(1.2,.72,.45);
if(aspects.some(a=>!Number.isFinite(a)||a<=0))throw new Error('Aspect ratios must be positive finite numbers.');
const anchors=JSON.parse(fs.readFileSync('src/features/meridians/anchors.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('src/assets/anatomy/models.manifest.json','utf8'));
const epsilon=1e-5; // 0.01 mm, only to absorb numerical rounding; markers sit 2.5 mm off the mesh.
let failures=0;
for(const variant of ['male','female']){
 const buffer=fs.readFileSync('src/assets/anatomy/'+manifest[variant].sourceFile);
 // Geometry-only diagnostic; actual image decoding/materials are checked in Blender and browser.
 const loader=new GLTFLoader().register(()=>({name:'InspectionGeometryOnly',loadTexture:()=>Promise.resolve(null)}));
 const gltf=await loader.parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
 gltf.scene.updateMatrixWorld(true);
 const meshes=[];
 gltf.scene.traverse(object=>{if(object.isMesh)meshes.push(object);});
 for(const aspect of aspects){
  const blocked=[];
  const relevant=anchors.filter(anchor=>anchor.modelId===manifest[variant].id);
  for(const anchor of relevant){
   const position=new Vector3(...anchor.position);
   const direction=new Vector3(...anchor.viewDirection).normalize();
   const pose=cameraPose(anchor,aspect,manifest[variant].height);
   const camera=new Vector3(...pose.position),distance=camera.distanceTo(position);
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
