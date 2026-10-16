import {useEffect,useMemo,useState} from 'react';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Mesh,MeshStandardMaterial} from 'three';
import {useThree} from '@react-three/fiber';
import type {ModelVariant} from './types';
import bodies from './models.json';
import organModels from '../../assets/anatomy/organs.manifest.json';
import maleOrgans from '../../assets/anatomy/viscera-male-v2.glb?url';
import femaleOrgans from '../../assets/anatomy/viscera-female-v2.glb?url';
const urls={male:maleOrgans,female:femaleOrgans};
const cache=new Map<ModelVariant,Promise<GLTF>>();
function loadOrgans(variant:ModelVariant){
 const fit=organModels[variant],body=bodies.find(m=>m.variant===variant);
 if(!body||fit.bodyModelId!==body.id||fit.bodySha256!==body.sha256)return Promise.reject(Error('organ/body calibration mismatch'));
 let pending=cache.get(variant);
 if(!pending){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  pending=fetch(urls[variant],{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('organ load');return r.arrayBuffer();}).then(b=>new GLTFLoader().parseAsync(b,''));
  cache.set(variant,pending);const request=pending;
  pending.catch(()=>{if(cache.get(variant)===request)cache.delete(variant);}).finally(()=>clearTimeout(timer));
 }return pending;
}
export function Organs({variant,onLoad}:{variant:ModelVariant;onLoad:(ok:boolean)=>void}){
 const [loaded,setLoaded]=useState<{variant:ModelVariant;gltf:GLTF}|null>(null);const invalidate=useThree(s=>s.invalidate);
 useEffect(()=>{let active=true;loadOrgans(variant).then(gltf=>{if(active){setLoaded({variant,gltf});onLoad(true);invalidate();}},()=>{if(active)onLoad(false);});return()=>{active=false;};},[variant,onLoad,invalidate]);
 const object=useMemo(()=>{if(!loaded||loaded.variant!==variant)return null;const scene=loaded.gltf.scene.clone(true);scene.traverse(o=>{if(o instanceof Mesh){const m=(o.material as MeshStandardMaterial).clone();m.roughness=.38;m.metalness=.06;o.material=m;o.renderOrder=0;}});return scene;},[loaded,variant]);
 useEffect(()=>()=>{object?.traverse(o=>{if(o instanceof Mesh)(o.material as MeshStandardMaterial).dispose();});},[object]);
 // Each asset is already baked into its exact body's metre/Y-up coordinates.
 return object?<primitive object={object}/>:null;
}
