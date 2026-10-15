import {useEffect,useMemo} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,BufferGeometry,CanvasTexture,CatmullRomCurve3,Color,Float32BufferAttribute,TubeGeometry,Vector3} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {paths} from './data';
import type {ModelVariant} from './types';

export function MeridianNetwork({variant,visibleMeridians,texture}:{variant:ModelVariant;visibleMeridians:readonly string[];texture:CanvasTexture}){
 const data=useMemo(()=>{
  const primary:BufferGeometry[]=[],secondary:BufferGeometry[]=[],halos:BufferGeometry[]=[];
  const streams:{curve:CatmullRomCurve3;phase:number;color:Color}[]=[];
  for(const path of paths.filter(p=>p.variant===variant&&visibleMeridians.includes(p.meridianId))){
   const fine=path.role==='secondary';
   const curve=new CatmullRomCurve3(path.points.map(p=>new Vector3(...p)),false,'centripetal');
   const color=new Color(path.color);
   const steps=Math.min(700,Math.max(8,path.points.length));
   const tube=(radius:number,isHalo=false)=>{
    const geometry=new TubeGeometry(curve,steps,radius,5,false);
    const uv=geometry.getAttribute('uv'),colors=[];
    for(let i=0;i<uv.count;i++){
     const strength=fine?.65*(1-.75*uv.getX(i)):1;
     colors.push(color.r*strength,color.g*strength,color.b*strength);
    }
    geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
    if(isHalo)halos.push(geometry);else (fine?secondary:primary).push(geometry);
   };
   tube(fine?.00055:.00125);
   if(!fine){
    tube(.0042,true);
    streams.push({curve,phase:streams.length*.37,color});
   }
  }
  const merge=(items:BufferGeometry[])=>{
   const merged=items.length?mergeGeometries(items):new BufferGeometry();
   items.forEach(g=>g.dispose());return merged!;
  };
  const moving=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(new Float32Array(streams.length*6),3));
  moving.setAttribute('color',new Float32BufferAttribute(streams.flatMap(({color})=>[color.r,color.g,color.b,color.r,color.g,color.b]),3));
  return {primary:merge(primary),secondary:merge(secondary),halo:merge(halos),moving,streams};
 },[variant,visibleMeridians]);
 useEffect(()=>()=>{data.primary.dispose();data.secondary.dispose();data.halo.dispose();data.moving.dispose();},[data]);
 useFrame(({clock})=>{
  const position=data.moving.getAttribute('position');
  // A fixed phase still displays light when reduced motion disables the scene ticker.
  const time=matchMedia('(prefers-reduced-motion: reduce)').matches?0:clock.elapsedTime;
  data.streams.forEach(({curve,phase},index)=>{
   for(let particle=0;particle<2;particle++){
    const p=curve.getPoint((phase+particle*.5+time*.065)%1);
    position.setXYZ(index*2+particle,p.x,p.y,p.z);
   }
  });
  position.needsUpdate=true;
 });
 return <group name="surface-meridian-network">
  <mesh geometry={data.primary} renderOrder={1} raycast={()=>null}><meshBasicMaterial vertexColors transparent opacity={.92} toneMapped={false}/></mesh>
  <mesh geometry={data.secondary} renderOrder={1} raycast={()=>null}><meshBasicMaterial vertexColors transparent opacity={.64} toneMapped={false} depthWrite={false}/></mesh>
  <mesh geometry={data.halo} renderOrder={2} raycast={()=>null}><meshBasicMaterial vertexColors transparent opacity={.12} blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh>
  <points geometry={data.moving} renderOrder={2} raycast={()=>null}><pointsMaterial map={texture} vertexColors size={.014} transparent opacity={.95} blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></points>
 </group>;
}
