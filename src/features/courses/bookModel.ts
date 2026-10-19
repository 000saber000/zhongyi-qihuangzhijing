import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {Course} from '../../data/catalog';
import {courseBookTitle} from './courseTitle';

export type CourseBookModel={root:THREE.Group;cover:THREE.Group;materials:THREE.MeshStandardMaterial[];setOpacity:(value:number)=>void;setGlow:(value:number)=>void;dispose:()=>void};
const colors:Record<string,string>={green:'#284c38',gold:'#796039',rose:'#674247'};
type BookTextures={front:THREE.CanvasTexture;paper:THREE.CanvasTexture};
const textureCache=new Map<string,BookTextures>();
let cloth:THREE.CanvasTexture|null=null;
function paperTexture(title:string){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=683;
 const ctx=canvas.getContext('2d')!;ctx.scale(2/3,2/3);
 ctx.fillStyle='#e4d7b4';ctx.fillRect(0,0,768,1024);
 let seed=73;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<11000;i++){ctx.fillStyle=`rgba(104,83,45,${rand()*.035})`;ctx.fillRect(rand()*768,rand()*1024,1+rand()*2,1+rand()*2);}
 ctx.strokeStyle='#8a765344';ctx.strokeRect(70,75,628,870);
 ctx.fillStyle='#5f543a';ctx.textAlign='center';ctx.font='48px "Noto Serif CJK SC",serif';ctx.fillText(title,384,255);
 ctx.font='21px "Noto Serif CJK SC",serif';ctx.fillText('岐黄知境 · 开卷有知',384,330);
 ctx.strokeStyle='#9f8c6233';
 for(let y=440;y<800;y+=56){ctx.beginPath();ctx.moveTo(150,y);ctx.lineTo(620,y);ctx.stroke();}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function frontTexture(course:Course,image:HTMLImageElement){
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1024;
 const ctx=canvas.getContext('2d')!;ctx.scale(.75,.75);ctx.drawImage(image,0,0,1024,1366);
 if(course.color!=='green'){ctx.globalCompositeOperation='color';ctx.globalAlpha=.45;ctx.fillStyle=colors[course.color];ctx.fillRect(0,0,1024,1366);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}
 ctx.fillStyle='#293327';ctx.textAlign='center';ctx.font='132px "Noto Serif CJK SC","Songti SC",serif';
 [...courseBookTitle(course)].forEach((char,i)=>ctx.fillText(char,177,290+i*157));
 ctx.fillStyle='#606047';ctx.font='45px "Noto Serif CJK SC",serif';[...'岐黄学堂'].forEach((char,i)=>ctx.fillText(char,181,916+i*53));
 ctx.fillStyle='#d0bf91';ctx.font='24px "Noto Serif CJK SC",serif';ctx.textAlign='right';ctx.fillText(`${course.level} · 五单元`,875,1255);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
}
function clothTexture(){
 if(cloth)return cloth;
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
 const ctx=canvas.getContext('2d')!;ctx.fillStyle='#808080';ctx.fillRect(0,0,128,128);
 for(let n=0;n<128;n+=4){ctx.fillStyle=n%8?'#6d6d6d':'#aaa';ctx.fillRect(n,0,1,128);ctx.fillStyle=n%8?'#aaa':'#5b5b5b';ctx.fillRect(0,n,128,1);}
 cloth=new THREE.CanvasTexture(canvas);cloth.wrapS=cloth.wrapT=THREE.RepeatWrapping;cloth.repeat.set(8,12);return cloth;
}
function bookTextures(course:Course,image:HTMLImageElement){
 let textures=textureCache.get(course.id);
 if(!textures){textures={front:frontTexture(course,image),paper:paperTexture(courseBookTitle(course))};textureCache.set(course.id,textures);}
 return textures;
}
function leafGeometries(){
 const paper:THREE.BufferGeometry[]=[],edge:THREE.BufferGeometry[]=[];
 for(let n=0;n<26;n++){
  const geometry=new THREE.BoxGeometry(1.455,1.95,.0045);
  geometry.translate(-.006+(n%3)*.003,Math.sin(n*.53)*.002,-.132+n*.0104);
  (n%5===0?edge:paper).push(geometry);
 }
 const merged={paper:mergeGeometries(paper,false),edge:mergeGeometries(edge,false)};
 for(const geometry of [...paper,...edge])geometry.dispose();
 if(!merged.paper||!merged.edge)throw new Error('course leaf merge failed');
 return merged as {paper:THREE.BufferGeometry;edge:THREE.BufferGeometry};
}
export function createCourseBook(course:Course,image:HTMLImageElement):CourseBookModel{
 const root=new THREE.Group();root.name=`bound-book-${course.id}`;
 const cover=new THREE.Group();cover.name='right-hinged-front-cover';cover.position.set(.75,0,.165);root.add(cover);
 const textures=bookTextures(course,image),clothMap=clothTexture();
 const cloth=new THREE.MeshStandardMaterial({color:colors[course.color],roughness:.92,bumpMap:clothMap,bumpScale:.017});
 const outer=new THREE.MeshStandardMaterial({map:textures.front,roughness:.88,bumpMap:clothMap,bumpScale:.013});
 const paper=new THREE.MeshStandardMaterial({color:'#ded0aa',roughness:1});
 const edge=new THREE.MeshStandardMaterial({color:'#b8a57c',roughness:1});
 const inside=new THREE.MeshStandardMaterial({map:textures.paper,roughness:.98});
 const thread=new THREE.MeshStandardMaterial({color:'#c2aa77',roughness:.96});
 const materials=[cloth,outer,paper,edge,inside,thread];
 const geometries=new Set<THREE.BufferGeometry>();
 const mesh=(geometry:THREE.BufferGeometry,material:THREE.Material|THREE.Material[],parent:THREE.Group,x=0,y=0,z=0)=>{
  geometries.add(geometry);const object=new THREE.Mesh(geometry,material);object.position.set(x,y,z);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
 };
 // Both covers are real closed volumes; the front has independent paper and cloth faces.
 mesh(new RoundedBoxGeometry(1.5,2,.048,3,.012),[cloth,cloth,cloth,cloth,outer,inside],cover,-.75,0,0);
 mesh(new RoundedBoxGeometry(1.5,2,.048,3,.012),cloth,root,0,0,-.164);
 mesh(new THREE.BoxGeometry(1.445,1.94,.272),paper,root,0,0,-.002);
 mesh(new THREE.PlaneGeometry(1.415,1.9),inside,root,0,0,.137);
 // Individual leaves create visible stepped edges in side and top views; merged so each material is one draw call.
 const leaves=leafGeometries();
 mesh(leaves.paper,paper,root);mesh(leaves.edge,edge,root);
 mesh(new RoundedBoxGeometry(.075,2,.31,2,.01),cloth,root,.718,0,0);
 for(const y of [-.77,-.26,.25,.76]){
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(.642,y,.194),new THREE.Vector3(.782,y+.003,.19),new THREE.Vector3(.807,y,0),new THREE.Vector3(.78,y-.003,-.19),new THREE.Vector3(.64,y,-.194)]);
  mesh(new THREE.TubeGeometry(curve,18,.009,6,false),thread,root);
  mesh(new THREE.SphereGeometry(.014,8,6),thread,root,.657,y,.194);
 }
 root.userData.courseId=course.id;root.userData.physicalDepth=.376;
 return {root,cover,materials,
  setOpacity(value){materials.forEach(material=>{material.transparent=value<1;material.opacity=value;});},
  setGlow(value){for(const material of [cloth,outer]){material.emissive.set('#7c9564');material.emissiveIntensity=value*.18;}},
  dispose(){geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());}
 };
}
