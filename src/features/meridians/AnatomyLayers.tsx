import {useEffect,useMemo,useState} from 'react';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Mesh,MeshStandardMaterial} from 'three';
import {useThree} from '@react-three/fiber';
import type {ModelVariant} from './types';
import organUrl from '../../assets/anatomy/viscera-v1.glb?url';
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
 return object?<group position={[0,variant==='female'?-.02:0,-.018]} scale={variant==='female'?[.93,1.70/1.78,.93]:[1.06,1,1.04]}><primitive object={object}/></group>:null;
}
