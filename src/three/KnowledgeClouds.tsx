import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {spaceNodes,nodeById} from './knowledgeSpace';
import {galaxySpin} from './galaxyParams';
import {useStore} from '../state/store';
// Compact semantic star clusters, inspired by shiyun's poet + poem-cloud layering.
// These are decorative particles around the 88 actual knowledge entities, not extra entries.
export function createKnowledgeCloud(selected:string|null,filter:string,quality:"high"|"low",pointScale=1){const positions:number[]=[],colors:number[]=[],seeds:number[]=[];const count=quality==='high'?95:32;const relations=selected?nodeById.get(selected)?.item.relations||[]:[];
 for(const n of spaceNodes){if(filter!=='全部'&&n.item.type!==filter&&n.item.id!==selected)continue;const colour=new THREE.Color(n.color);const bright=selected?(selected===n.item.id||relations.includes(n.item.id)?1.8:.22):.6;for(let i=0;i<count;i++){const seed=Math.sin(n.index*137.13+i*57.41)*43758.5453;const random=seed-Math.floor(seed);const y=1-2*(i+.5)/count;const theta=i*Math.PI*(3-Math.sqrt(5))+n.index;const radial=Math.sqrt(Math.max(0,1-y*y));const radius=15+Math.pow(random,.8)*160;positions.push(n.position[0]+Math.cos(theta)*radial*radius,n.position[1]+y*radius*.6,n.position[2]+Math.sin(theta)*radial*radius);colors.push(colour.r*bright,colour.g*bright,colour.b*bright);seeds.push(random*6.28)}}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('aColor',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('aSeed',new THREE.Float32BufferAttribute(seeds,1));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:{value:0},uPointScale:{value:pointScale}},vertexShader:`uniform float uPointScale;attribute vec3 aColor;attribute float aSeed;varying vec3 vColor;varying float vSeed;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(9.*uPointScale*(1400./-p.z),.6,9.);vColor=aColor;vSeed=aSeed;}`,fragmentShader:`varying vec3 vColor;varying float vSeed;uniform float uTime;void main(){float d=length(gl_PointCoord-.5)*2.;float a=exp(-d*d*5.);float twinkle=.75+.25*sin(uTime*.8+vSeed);gl_FragColor=vec4(vColor*a*twinkle,a);}`});return new THREE.Points(geometry,material)}
export default function KnowledgeClouds({selected,filter}:{selected:string|null;filter:string}){
 const group=useRef<THREE.Group>(null);const quality=useStore(s=>s.quality);
 const cloud=useMemo(()=>{return createKnowledgeCloud(selected,filter,quality)},[filter,selected,quality,spaceNodes]);
 useEffect(()=>()=>{cloud.geometry.dispose();cloud.material.dispose()},[cloud]);useFrame((_,dt)=>{if(!useStore.getState().cinema&&!useStore.getState().reading)cloud.material.uniforms.uTime.value+=Math.min(dt,.05);if(group.current)group.current.rotation.y=galaxySpin.angle});return <group ref={group}><primitive object={cloud}/></group>
}
