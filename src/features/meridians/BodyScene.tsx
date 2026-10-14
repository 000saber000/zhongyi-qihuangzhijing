import {useEffect,useMemo,useRef,useState} from 'react';
import {Canvas,useFrame,useThree,type ThreeEvent} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {OrbitControls as OrbitControlsImpl} from 'three-stdlib';
import {Group,Mesh,MeshStandardMaterial,Vector3,Raycaster,Color,SRGBColorSpace,ACESFilmicToneMapping} from 'three';
import type {AcupointAnchor,ModelVariant,Selection} from './types';
import {colorFor,definitions} from './data';
import {modelUrls} from './assets';
import {cameraPose,fullBodyPose,interpolateOrbit,nearestVisibleMarker,type CameraPose,type View} from './camera';
// Bounded to the two immutable, same-origin assets. Failed requests are evicted for retry.
const cache=new Map<ModelVariant,Promise<GLTF>>();
export function loadBody(variant:ModelVariant):Promise<GLTF>{
 let promise=cache.get(variant);if(!promise){
  promise=new Promise<GLTF>((resolve,reject)=>{
   const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
   fetch(modelUrls[variant],{signal:controller.signal}).then(async response=>{if(!response.ok)throw Error('模型资源未能读取');return response.arrayBuffer();}).then(buffer=>new GLTFLoader().parseAsync(buffer,'')).then(resolve,reject).finally(()=>clearTimeout(timer));
  });cache.set(variant,promise);promise.catch(()=>{if(cache.get(variant)===promise)cache.delete(variant);});
 }return promise;
}
type Props={variant:ModelVariant;requestId:number;anchors:AcupointAnchor[];selection:Selection;view:View;viewVersion:number;showMarkers:boolean;cameraMode:'point'|'view';interactive:boolean;onSelect:(selection:Selection)=>void;onLoad:(id:number,ok:boolean)=>void;onLost:()=>void;onSettled:(key:string)=>void};
export default function BodyScene(props:Props){
 return <Canvas frameloop="demand" camera={{position:[0,.89,3],fov:45,near:.01,far:30}} dpr={[1,1.5]} gl={{antialias:true,alpha:true,powerPreference:'high-performance'}} onCreated={({gl})=>{gl.outputColorSpace=SRGBColorSpace;gl.toneMapping=ACESFilmicToneMapping;gl.toneMappingExposure=1.18;}}>
  <World {...props}/>
 </Canvas>;
}
function World({variant,requestId,anchors,selection,view,viewVersion,showMarkers,cameraMode,interactive,onSelect,onLoad,onLost,onSettled}:Props){
 const [loaded,setLoaded]=useState<{variant:ModelVariant;scene:Group}|null>(null);
 const {camera,size,gl,invalidate}=useThree();const controls=useRef<OrbitControlsImpl>(null);
 const flight=useRef<{from:CameraPose;to:CameraPose;startedAt:number;key:string}|null>(null);
 useEffect(()=>{let active=true;loadBody(variant).then(gltf=>{if(active){setLoaded({variant,scene:gltf.scene});onLoad(requestId,true);}},()=>{if(active)onLoad(requestId,false);});return()=>{active=false;};},[variant,requestId,onLoad]);
 useEffect(()=>{const lost=(e:Event)=>{e.preventDefault();onLost();};const el=gl.domElement;el.addEventListener('webglcontextlost',lost);return()=>{el.removeEventListener('webglcontextlost',lost);};},[gl,onLost]);
 const object=useMemo(()=>{
  if(!loaded)return null;
  const copy=loaded.scene.clone(true);
  copy.traverse(child=>{if(child instanceof Mesh){child.material=Array.isArray(child.material)?child.material.map(m=>m.clone()):child.material.clone();child.castShadow=false;child.receiveShadow=false;
   const materials=Array.isArray(child.material)?child.material:[child.material];
   for(const material of materials)if(material instanceof MeshStandardMaterial){material.roughness=.32;material.metalness=.08;}
  }});return copy;
 },[loaded]);
 useEffect(()=>()=>{object?.traverse(child=>{if(child instanceof Mesh){for(const m of Array.isArray(child.material)?child.material:[child.material])m.dispose();}});},[object]);
 const activeAnchor=selection?anchors.find(a=>a.knowledgeId===selection.knowledgeId&&a.side===selection.side)??null:null;
 useEffect(()=>{
  if(!object||!controls.current)return;
  const target=activeAnchor&&cameraMode==='point'?cameraPose(activeAnchor,size.width/size.height):fullBodyPose(view,size.width/size.height,loaded?.variant==='female'?1.70:1.78);
  const from:CameraPose={position:camera.position.toArray() as [number,number,number],target:controls.current.target.toArray() as [number,number,number]};
  const key=selection&&cameraMode==='point'?selection.knowledgeId+':'+selection.side:'full:'+view;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){camera.position.fromArray(target.position);controls.current.target.fromArray(target.target);controls.current.update();onSettled(key);flight.current=null;}
  else flight.current={from,to:target,startedAt:performance.now(),key};
  invalidate();
 },[object,activeAnchor,view,viewVersion,size.width,size.height,camera,loaded?.variant,onSettled,selection,cameraMode,invalidate]);
 useFrame(()=>{const f=flight.current,c=controls.current;if(!f||!c)return;const elapsed=(performance.now()-f.startedAt)/1000;const pose=interpolateOrbit(f.from,f.to,elapsed/.85);camera.position.fromArray(pose.position);c.target.fromArray(pose.target);c.update();if(elapsed>=.85){flight.current=null;onSettled(f.key);}else invalidate();});
 const meshes=useMemo(()=>{const result:Mesh[]=[];object?.traverse(o=>{if(o instanceof Mesh)result.push(o);});return result;},[object]);
 const raycaster=useMemo(()=>new Raycaster(),[]);
 const choose=(event:ThreeEvent<MouseEvent>,anchor:AcupointAnchor)=>{
  if(!interactive||event.delta>4)return;event.stopPropagation();
  const normal=new Vector3().fromArray(anchor.outwardNormal),towardCamera=event.ray.origin.clone().sub(new Vector3().fromArray(anchor.position));
  if(normal.dot(towardCamera)<=0)return;
  raycaster.set(event.ray.origin,event.ray.direction);
  const markerKey=anchor.knowledgeId+':'+anchor.side;
  const center=new Vector3().fromArray(anchor.position);raycaster.set(event.ray.origin,center.clone().sub(event.ray.origin).normalize());
  const hits=[{kind:'marker' as const,distance:center.distanceTo(event.ray.origin),id:markerKey},...raycaster.intersectObjects(meshes,false).map(hit=>({kind:'body' as const,distance:hit.distance}))];
  if(nearestVisibleMarker(hits)===markerKey)onSelect({knowledgeId:anchor.knowledgeId,side:anchor.side});
 };
 return <>
  <ambientLight intensity={1.5}/><hemisphereLight args={['#e6efdd','#102c25',2.4]}/>
  <directionalLight position={[-2,3,3]} intensity={3} color="#f7ecd2"/><directionalLight position={[2,2,-2]} intensity={4} color="#7eb9a4"/><directionalLight position={[2,.6,2]} intensity={1.1} color="#c7e3d5"/>
  {object&&<primitive object={object} onClick={(e:ThreeEvent<MouseEvent>)=>e.stopPropagation()}/>}
  {object&&showMarkers&&anchors.map(anchor=>{const selected=anchor===activeAnchor,color=colorFor(definitions.find(d=>d.knowledgeId===anchor.knowledgeId)?.meridianId??null);return <group key={anchor.knowledgeId+anchor.side} position={anchor.position}>
   <mesh onClick={e=>choose(e,anchor)}><sphereGeometry args={[selected?.008:.0065,12,8]}/><meshBasicMaterial color={selected?'#fff2c9':color} toneMapped={false}/></mesh>
   <mesh onClick={e=>choose(e,anchor)}><sphereGeometry args={[.017,12,8]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/></mesh>
   {selected&&<mesh><sphereGeometry args={[.013,16,12]}/><meshBasicMaterial color={color} transparent opacity={.2} depthWrite={false}/></mesh>}
  </group>;})}
  <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.09} enablePan minDistance={.18} maxDistance={6} minPolarAngle={.06} maxPolarAngle={Math.PI-.06} target={[0,.89,0]} onStart={()=>{flight.current=null;}}/>
 </>;
}
