// Centre-bundled cubic curves and travelling pulse adapted from shiyun GiftLines.tsx.
// Required Notice: Copyright © 2026 Cohenjikan — 诗云 / Poetry Cloud
// https://github.com/Cohenjikan/shiyun
// PolyForm Noncommercial 1.0.0: https://polyformproject.org/licenses/noncommercial/1.0.0/
import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {nodeById,relationEdges} from './knowledgeSpace';
import {galaxySpin} from './galaxyParams';
import {useStore} from '../state/store';
export default function RelationLight({selected,show}:{selected:string|null;show:boolean}){
 const group=useRef<THREE.Group>(null);
 const object=useMemo(()=>{const pos:number[]=[],colors:number[]=[],ts:number[]=[],seeds:number[]=[];
 const edges=selected?relationEdges.filter(e=>e.from===selected||e.to===selected):relationEdges.filter((_,i)=>i%6===0);
 for(const [index,e] of edges.entries()){const a=nodeById.get(e.from)!,b=nodeById.get(e.to)!;const va=new THREE.Vector3(...a.position),vb=new THREE.Vector3(...b.position);const c1=va.clone().lerp(vb,.33).multiplyScalar(.72),c2=va.clone().lerp(vb,.67).multiplyScalar(.72);c1.y+=170;c2.y+=170;const curve=new THREE.CubicBezierCurve3(va,c1,c2,vb);const points=curve.getPoints(48);const ca=new THREE.Color(a.color),cb=new THREE.Color(b.color);for(let i=0;i<48;i++){for(const step of [i,i+1]){const t=step/48,v=points[step],c=ca.clone().lerp(cb,t).multiplyScalar((selected?.85:.18)*Math.sin(t*Math.PI));pos.push(v.x,v.y,v.z);colors.push(c.r,c.g,c.b);ts.push(t);seeds.push(index*.17)}}}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('aColor',new THREE.Float32BufferAttribute(colors,3));geo.setAttribute('aT',new THREE.Float32BufferAttribute(ts,1));geo.setAttribute('aSeed',new THREE.Float32BufferAttribute(seeds,1));
 const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:{value:0}},vertexShader:`attribute vec3 aColor;attribute float aT;attribute float aSeed;varying vec3 vColor;varying float vT;varying float vSeed;void main(){vColor=aColor;vT=aT;vSeed=aSeed;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vColor;varying float vT;varying float vSeed;uniform float uTime;void main(){float phase=fract(uTime*.16+vSeed);float d=vT-phase;d=d-floor(d+.5);float pulse=1.-smoothstep(0.,.08,abs(d));vec3 c=vColor*(1.+pulse*3.);float a=max(max(c.r,c.g),c.b);gl_FragColor=vec4(c,a);}`});return new THREE.LineSegments(geo,mat)},[selected,relationEdges]);
 useEffect(()=>()=>{object.geometry.dispose();object.material.dispose()},[object]);
 useFrame((_,dt)=>{if(!useStore.getState().cinema&&!useStore.getState().reading)object.material.uniforms.uTime.value+=dt;if(group.current)group.current.rotation.y=galaxySpin.angle});
 return <group ref={group} visible={show}><primitive object={object}/></group>
}
