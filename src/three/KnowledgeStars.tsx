import {useMemo,useRef,useState} from 'react';
import {Html} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {spaceNodes,landmarks,nodeById} from './knowledgeSpace';
import {galaxySpin} from './galaxyParams';
import {discTexture} from './disc';
import {useStore} from '../state/store';
export default function KnowledgeStars({selected,filter,select}:{selected:string|null;filter:string;select:(id:string)=>void}){
 const group=useRef<THREE.Group>(null);const time=useRef(0);const [hover,setHover]=useState<string|null>(null);
 const related=useMemo(()=>new Set(selected?[selected,...(nodeById.get(selected)?.item.relations||[]),...spaceNodes.filter(n=>n.item.relations.includes(selected)).map(n=>n.item.id)]:[]),[selected]);
 useFrame((_,dt)=>{if(group.current)group.current.rotation.y=galaxySpin.angle;if(!useStore.getState().cinema&&!useStore.getState().reading)time.current+=dt});
 return <group ref={group}>{spaceNodes.map(n=>{const active=selected===n.item.id;const filtered=filter==='全部'||filter===n.item.type;const bright=active||hover===n.item.id;const label=bright||related.has(n.item.id)||(!selected&&landmarks.has(n.item.id)&&filtered);return <group key={n.item.id} position={n.position} visible={filtered||active}>
 <sprite scale={bright?[260,260,1]:[80,80,1]}><spriteMaterial map={discTexture()} color={n.color} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={selected&&!related.has(n.item.id)?.15:.8}/></sprite>
 <mesh onClick={e=>{e.stopPropagation();select(n.item.id)}} onPointerOver={e=>{e.stopPropagation();setHover(n.item.id);document.body.style.cursor='pointer'}} onPointerOut={()=>{setHover(null);document.body.style.cursor='auto'}}><sphereGeometry args={[bright?17:6,10,10]}/><meshBasicMaterial color={bright?'#fff8e2':n.color} toneMapped={false}/></mesh>
 {active&&<mesh rotation={[Math.PI/2,0,0]}><ringGeometry args={[65,67,64]}/><meshBasicMaterial color={n.color} transparent opacity={.55} side={THREE.DoubleSide}/></mesh>}
 {label&&<Html position={[0,bright?105:70,0]} center zIndexRange={[12,1]} style={{pointerEvents:'auto'}}><button className={`star-label ${bright?'bright':''} ${active?'chosen':''}`} style={{color:n.color}} aria-label={`星辰 ${n.item.title}`} onClick={e=>{e.stopPropagation();select(n.item.id)}}><i/><span>{n.item.title}</span>{active&&<small>正在探索</small>}</button></Html>}
 </group>})}</group>
}
