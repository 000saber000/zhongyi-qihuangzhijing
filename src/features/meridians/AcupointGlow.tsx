import {useEffect,useMemo,useRef} from 'react';
import {Billboard,Html} from '@react-three/drei';
import {useFrame,type ThreeEvent} from '@react-three/fiber';
import {AdditiveBlending,BufferGeometry,Float32BufferAttribute,CanvasTexture,Group,Mesh,Sprite,Vector3} from 'three';
import {markerIsVisible} from './state';
import type {AcupointAnchor} from './types';
export function makeGlowTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
 const ctx=canvas.getContext('2d')!,gradient=ctx.createRadialGradient(32,32,0,32,32,32);
 gradient.addColorStop(0,'rgba(255,255,230,1)');gradient.addColorStop(.1,'rgba(255,255,240,.95)');gradient.addColorStop(.25,'rgba(255,255,255,.45)');gradient.addColorStop(.5,'rgba(255,255,255,.12)');gradient.addColorStop(1,'rgba(255,255,255,0)');
 ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);return new CanvasTexture(canvas);
}
type Props={anchor:AcupointAnchor;texture:CanvasTexture;index:number;detail:boolean;revealAll:boolean;selected:boolean;hovered:boolean;name:string;code:string;onEnter:(e:ThreeEvent<PointerEvent>)=>void;onLeave:()=>void;onChoose:(e:ThreeEvent<MouseEvent>)=>void};
export default function AcupointGlow({anchor,texture,index,detail,revealAll,selected,hovered,name,code,onEnter,onLeave,onChoose}:Props){
 const marker=useRef<Group>(null),float=useRef<Group>(null),halo=useRef<Sprite>(null),dust=useRef<Group>(null),color=index%4===0?'#9debed':'#f5d187';
 const position=useMemo(()=>new Vector3(...anchor.position),[anchor.position]);
 const normal=useMemo(()=>new Vector3(...anchor.outwardNormal).normalize(),[anchor.outwardNormal]);
 // Exclude hidden details from R3F's hover map as well as the rendered frame.
 const hitTest:Mesh['raycast']=function(this:Mesh,raycaster,hits){if(markerIsVisible(detail,raycaster.ray.origin.distanceTo(position),selected||hovered||revealAll))Mesh.prototype.raycast.call(this,raycaster,hits);};
 const particles=useMemo(()=>{const positions=Array.from({length:7},(_,i)=>{const angle=i*2.399+index,r=.017+(i%3)*.004;return [Math.cos(angle)*r,Math.sin(angle)*r,.002*(i%3)];}).flat();return new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3));},[index]);
 useEffect(()=>()=>particles.dispose(),[particles]);
 useFrame(({clock,camera})=>{const t=clock.elapsedTime+index*.73;if(marker.current)marker.current.visible=markerIsVisible(detail,camera.position.distanceTo(position),selected||hovered||revealAll);marker.current?.scale.setScalar(Math.max(.28,Math.min(1,camera.position.distanceTo(position)/1.3)));float.current?.position.copy(normal).multiplyScalar(.0025+.002*Math.sin(t*1.25));if(halo.current){const r=((hovered||selected) ? .095 : .072)*(1+.14*Math.sin(t*1.7));halo.current.scale.set(r,r,1);}if(dust.current)dust.current.rotation.z=t*.12;});
 return <group ref={marker} position={anchor.position}>
  <mesh raycast={hitTest} onPointerOver={onEnter} onPointerOut={onLeave} onClick={onChoose}><sphereGeometry args={[.023,10,8]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/></mesh>
  <group ref={float}>
   <mesh raycast={()=>null}><sphereGeometry args={[(selected||hovered) ? .009 : .0075,12,8]}/><meshBasicMaterial color={selected||hovered?'#fff4d0':color} toneMapped={false}/></mesh>
   <sprite ref={halo} scale={[.072,.072,1]} raycast={()=>null}><spriteMaterial map={texture} color={color} transparent opacity={hovered||selected?1:.8} blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></sprite>
   <Billboard><mesh raycast={()=>null}><ringGeometry args={[(selected||hovered) ? .024 : .017,(selected||hovered) ? .0248 : .0175,40]}/><meshBasicMaterial color={color} transparent opacity={(hovered||selected) ? .8 : .32} depthWrite={false} toneMapped={false}/></mesh><group ref={dust}><points geometry={particles} raycast={()=>null}><pointsMaterial map={texture} size={.005} color={color} opacity={.75} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></points></group></Billboard>
  </group>
  {hovered&&<Html zIndexRange={[15,10]} style={{pointerEvents:'none'}}><div className="acupoint-tooltip" role="tooltip"><b>{name}<small>{code}</small></b><span>{anchor.side==='midline'?'人体正中':anchor.side==='left'?'人体左侧':'人体右侧'} · 点击定位</span></div></Html>}
 </group>;
}
