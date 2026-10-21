import {useMemo,useRef,useState,type CSSProperties} from 'react';
import {Html} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {spaceNodes,landmarks,nodeById} from './knowledgeSpace';
import {galaxySpin} from './galaxyParams';
import {discTexture} from './disc';
import {useStore} from '../state/store';
export default function KnowledgeStars({selected,filter,select}:{selected:string|null;filter:string;select:(id:string)=>void}){
 const group=useRef<THREE.Group>(null);const time=useRef(0);const layoutTime=useRef(0);const labels=useRef(new Map<string,HTMLButtonElement>());const [hover,setHover]=useState<string|null>(null);
 const related=useMemo(()=>new Set(selected?[selected,...(nodeById.get(selected)?.item.relations||[]),...spaceNodes.filter(n=>n.item.relations.includes(selected)).map(n=>n.item.id)]:[]),[selected,spaceNodes]);
 useFrame(({camera,size},dt)=>{
  if(group.current)group.current.rotation.y=galaxySpin.angle;
  if(!useStore.getState().cinema&&!useStore.getState().reading)time.current+=dt;
  layoutTime.current+=dt;if(layoutTime.current<.12||!group.current)return;layoutTime.current=0;
  group.current.updateMatrixWorld();
  const placed:{left:number;right:number;top:number;bottom:number}[]=[];
  const entries=[...labels.current].sort(([a],[b])=>Number(b===selected)-Number(a===selected));
  entries.forEach(([id,element])=>{
   const node=nodeById.get(id);if(!node||!element.isConnected)return;
   const world=new THREE.Vector3(node.position[0],node.position[1]+80,node.position[2]).applyMatrix4(group.current!.matrixWorld).project(camera);
   const anchorX=(world.x*.5+.5)*size.width,anchorY=(-world.y*.5+.5)*size.height;
   const width=element.offsetWidth,height=element.offsetHeight,gap=7;
   const candidates:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[
    [0,-3],[0,-height-9],[0,height+9],[width*.58+10,0],[-width*.58-10,0],[width*.52,-height-7],[-width*.52,-height-7]
   ];
   const chosen=candidates.find(([x,y])=>{const box={left:anchorX+x-width/2-gap,right:anchorX+x+width/2+gap,top:anchorY+y-height/2-gap,bottom:anchorY+y+height/2+gap};return !placed.some(p=>box.left<p.right&&box.right>p.left&&box.top<p.bottom&&box.bottom>p.top)})||candidates[candidates.length-1];
   const [x,y]=chosen;element.style.setProperty('--label-layout-x',`${x.toFixed(1)}px`);element.style.setProperty('--label-layout-y',`${y.toFixed(1)}px`);
   placed.push({left:anchorX+x-width/2-gap,right:anchorX+x+width/2+gap,top:anchorY+y-height/2-gap,bottom:anchorY+y+height/2+gap});
  });
 });
 return <group ref={group}>{spaceNodes.map(n=>{const active=selected===n.item.id;const filtered=filter==='全部'||filter===n.item.type;const bright=active||hover===n.item.id;const label=bright||related.has(n.item.id)||(!selected&&landmarks.has(n.item.id)&&filtered);return <group key={n.item.id} position={n.position} visible={filtered||active}>
 <sprite scale={bright?[260,260,1]:[80,80,1]}><spriteMaterial map={discTexture()} color={n.color} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={selected&&!related.has(n.item.id)?.15:.8}/></sprite>
 <mesh><sphereGeometry args={[bright?17:6,10,10]}/><meshBasicMaterial color={bright?'#fff8e2':n.color} toneMapped={false}/></mesh>
 {(filtered||active)&&<mesh onClick={e=>{e.stopPropagation();if(e.delta<=6)select(n.item.id)}} onPointerOver={e=>{e.stopPropagation();setHover(n.item.id);document.body.style.cursor='pointer'}} onPointerOut={()=>{setHover(null);document.body.style.cursor='auto'}}><sphereGeometry args={[120,10,10]}/><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false}/></mesh>}
 {active&&<mesh rotation={[Math.PI/2,0,0]}><ringGeometry args={[65,67,64]}/><meshBasicMaterial color={n.color} transparent opacity={.55} side={THREE.DoubleSide}/></mesh>}
 {label&&<Html position={[0,80,0]} center zIndexRange={bright?[24,20]:[12,1]} style={{pointerEvents:'auto'}}><button ref={element=>{if(element)labels.current.set(n.item.id,element);else labels.current.delete(n.item.id)}} className={`star-label ${bright?'bright':''} ${active?'chosen':''}`} style={{color:n.color,'--star-color':n.color} as CSSProperties} onPointerEnter={()=>setHover(n.item.id)} onPointerLeave={e=>{setHover(null);e.currentTarget.style.removeProperty('--label-pointer-x');e.currentTarget.style.removeProperty('--label-pointer-y')}} onPointerMove={e=>{const r=e.currentTarget.getBoundingClientRect();e.currentTarget.style.setProperty('--label-pointer-x',`${Math.max(-3,Math.min(3,(e.clientX-r.left-r.width/2)*.06))}px`);e.currentTarget.style.setProperty('--label-pointer-y',`${Math.max(-2,Math.min(2,(e.clientY-r.top-r.height/2)*.06))}px`)}} onFocus={()=>setHover(n.item.id)} onBlur={()=>setHover(null)} aria-label={`星辰 ${n.item.title}`} onClick={e=>{e.stopPropagation();select(n.item.id)}}><i/><span>{n.item.title}</span>{active&&<small>正在探索</small>}</button></Html>}
 </group>})}</group>
}
