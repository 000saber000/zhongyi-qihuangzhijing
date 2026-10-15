import {useEffect,useMemo,useState} from 'react';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {CatmullRomCurve3,Mesh,MeshStandardMaterial,TubeGeometry,Vector3} from 'three';
import {useThree} from '@react-three/fiber';
import type {ModelVariant} from './types';
import organUrl from '../../assets/anatomy/viscera-v1.glb?url';
import {paths} from './data';
let organPromise:Promise<GLTF>|null=null;
function loadOrgans(){
 if(!organPromise){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  const pending=fetch(organUrl,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('organ load');return r.arrayBuffer();}).then(b=>new GLTFLoader().parseAsync(b,''));
  organPromise=pending;pending.catch(()=>{if(organPromise===pending)organPromise=null;}).finally(()=>clearTimeout(timer));
 }return organPromise;
}
export function Organs({variant,onLoad}:{variant:ModelVariant;onLoad:(ok:boolean)=>void}){
 const [gltf,setGltf]=useState<GLTF|null>(null);const invalidate=useThree(s=>s.invalidate);
 useEffect(()=>{let active=true;loadOrgans()!.then(data=>{if(active){setGltf(data);onLoad(true);invalidate();}},()=>{if(active)onLoad(false);});return()=>{active=false;};},[onLoad,invalidate]);
 const object=useMemo(()=>{if(!gltf)return null;const scene=gltf.scene.clone(true);scene.traverse(o=>{if(o instanceof Mesh){const m=(o.material as MeshStandardMaterial).clone();m.roughness=.38;m.metalness=.06;o.material=m;o.renderOrder=0;}});return scene;},[gltf]);
 useEffect(()=>()=>{object?.traverse(o=>{if(o instanceof Mesh)(o.material as MeshStandardMaterial).dispose();});},[object]);
 return object?<group scale={variant==='female'?[.88,1.70/1.78,.91]:[1,1,1]}><primitive object={object}/></group>:null;
}
function MeridianTrace({points,color}:{points:readonly (readonly [number,number,number])[];color:string}){
 const geometry=useMemo(()=>new TubeGeometry(new CatmullRomCurve3(points.map(p=>new Vector3(...p as [number,number,number]))),Math.min(160,points.length*3),.0015,5,false),[points]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <mesh geometry={geometry} renderOrder={1}><meshBasicMaterial color={color} transparent opacity={.85} toneMapped={false}/></mesh>;
}
export function MeridianNetwork({variant}:{variant:ModelVariant}){
 return <group>{paths.filter(p=>p.variant===variant).map(p=><MeridianTrace key={p.meridianId+':'+p.side+':'+p.segment} points={p.points} color={p.color}/>)}</group>;
}
