// Read-only inspection of the actual exported geometry and preset sight lines.
// Run from repository root: node scripts/anatomy/verify-views.mjs
// Optional aspect ratios: append 1.2 0.72 0.45.
// This checks final sight lines, not anatomical accuracy or camera flight paths.
import fs from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {Vector3,Raycaster} from 'three';
import {cameraPose} from '../../src/features/meridians/camera.ts';

const aspects=process.argv.slice(2).map(Number);
if(!aspects.length)aspects.push(1.2,.72,.45);
if(aspects.some(a=>!Number.isFinite(a)||a<=0))throw new Error('Aspect ratios must be positive finite numbers.');
const anchors=JSON.parse(fs.readFileSync('src/features/meridians/anchors.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('src/assets/anatomy/models.manifest.json','utf8'));
const epsilon=1e-5; // 0.01 mm, only to absorb numerical rounding; markers sit 2.5 mm off the mesh.
// Geometry-only diagnostic: strip material texture references so no image decoder is needed in Node.
function stripTextures(buffer){
 const view=new DataView(buffer),jsonLength=view.getUint32(12,true),jsonStart=20;
 const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,jsonStart,jsonLength)));
 for(const material of json.materials??[]){
  for(const slot of ['normalTexture','occlusionTexture','emissiveTexture'])delete material[slot];
  for(const slot of ['baseColorTexture','metallicRoughnessTexture'])delete material.pbrMetallicRoughness?.[slot];
 }
 const encoded=new TextEncoder().encode(JSON.stringify(json)),padding=(4-encoded.length%4)%4;
 const tail=new Uint8Array(buffer,jsonStart+jsonLength),length=12+8+encoded.length+padding+tail.length;
 const out=new Uint8Array(length),outView=new DataView(out.buffer);
 outView.setUint32(0,0x46546C67,true);outView.setUint32(4,2,true);outView.setUint32(8,length,true);
 outView.setUint32(12,encoded.length+padding,true);outView.setUint32(16,0x4E4F534A,true);
 out.set(encoded,20);out.fill(0x20,20+encoded.length,20+encoded.length+padding);
 out.set(tail,20+encoded.length+padding);
 return out.buffer;
}
let failures=0;
for(const variant of ['male','female']){
 const file=fs.readFileSync('src/assets/anatomy/'+manifest[variant].sourceFile);
 const buffer=stripTextures(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength));
 // Geometry-only diagnostic; actual image decoding/materials are checked in Blender and browser.
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const gltf=await loader.parseAsync(buffer,'');
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
