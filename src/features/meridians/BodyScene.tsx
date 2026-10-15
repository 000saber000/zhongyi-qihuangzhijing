import {useEffect,useMemo,useRef,useState} from 'react';
import {Canvas,useFrame,useThree,type ThreeEvent} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {OrbitControls as OrbitControlsImpl} from 'three-stdlib';
import {Group,Mesh,MeshStandardMaterial,MeshPhysicalMaterial,Vector3,Raycaster,SRGBColorSpace,ACESFilmicToneMapping} from 'three';
import type {AcupointAnchor,ModelVariant,Selection} from './types';
import {definitions} from './data';
import AcupointGlow,{makeGlowTexture} from './AcupointGlow';
import {Organs,MeridianNetwork} from './AnatomyLayers';
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
type Props={xray:boolean;showOrgans:boolean;showMeridians:boolean;bodyOpacity:number;pointNames:Record<string,string>;onOrganLoad:(ok:boolean)=>void;variant:ModelVariant;requestId:number;anchors:AcupointAnchor[];selection:Selection;view:View;viewVersion:number;showMarkers:boolean;cameraMode:'point'|'view';interactive:boolean;onSelect:(selection:Selection)=>void;onLoad:(id:number,ok:boolean)=>void;onLost:()=>void;onSettled:(key:string)=>void};
export default function BodyScene(props:Props){
 return <Canvas frameloop="demand" camera={{position:[0,.89,3],fov:45,near:.01,far:30}} dpr={[1,1.5]} gl={{antialias:true,alpha:true,powerPreference:'high-performance'}} onCreated={({gl})=>{gl.outputColorSpace=SRGBColorSpace;gl.toneMapping=ACESFilmicToneMapping;gl.toneMappingExposure=.94;}}>
  <World {...props}/>
 </Canvas>;
}
function World({variant,requestId,anchors,selection,view,viewVersion,showMarkers,cameraMode,interactive,onSelect,onLoad,onLost,onSettled,xray,showOrgans,showMeridians,bodyOpacity,pointNames,onOrganLoad}:Props){
 const [hovered,setHovered]=useState<string|null>(null);
 const glow=useMemo(makeGlowTexture,[]);useEffect(()=>()=>glow.dispose(),[glow]);
 const [loaded,setLoaded]=useState<{variant:ModelVariant;scene:Group}|null>(null);
 const {camera,size,gl,invalidate}=useThree();const controls=useRef<OrbitControlsImpl>(null);
 const flight=useRef<{from:CameraPose;to:CameraPose;startedAt:number;key:string}|null>(null);
 useEffect(()=>{let active=true;loadBody(variant).then(gltf=>{if(active){setLoaded({variant,scene:gltf.scene});onLoad(requestId,true);}},()=>{if(active)onLoad(requestId,false);});return()=>{active=false;};},[variant,requestId,onLoad]);
 useEffect(()=>{const lost=(e:Event)=>{e.preventDefault();onLost();};const el=gl.domElement;el.addEventListener('webglcontextlost',lost);return()=>{el.removeEventListener('webglcontextlost',lost);};},[gl,onLost]);
 const object=useMemo(()=>{
  if(!loaded)return null;
  const copy=loaded.scene.clone(true);
  copy.traverse(child=>{if(child instanceof Mesh){
   const originals=Array.isArray(child.material)?child.material:[child.material];
   const materials=originals.map(original=>{
    const m=new MeshPhysicalMaterial({color:original instanceof MeshStandardMaterial?original.color:'#b5cdb1',roughness:.26,metalness:.07,clearcoat:.45,clearcoatRoughness:.28});
    m.userData.xrayUniform={value:0};
    m.onBeforeCompile=shader=>{
     shader.uniforms.uJadeXray=m.userData.xrayUniform;
     shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vJadePosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvJadePosition = position;');
     shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vJadePosition;\nuniform float uJadeXray;').replace('#include <color_fragment>',`#include <color_fragment>
       float jade = sin(vJadePosition.x*90.0 + sin(vJadePosition.y*38.0)*3.0 + vJadePosition.z*45.0);
       float vein = pow(0.5 + 0.5*jade, 25.0);
       diffuseColor.rgb *= 0.96 + 0.035*sin(vJadePosition.y*65.0 + vJadePosition.x*70.0);
       diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.45,0.47,0.27), vein*0.12);`).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
       float jadeRim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);
       totalEmissiveRadiance += uJadeXray * vec3(0.10,0.20,0.13) * (0.6 + jadeRim);
       diffuseColor.a *= mix(1.0, 0.7 + jadeRim*1.1, uJadeXray);`);
    };return m;
   });child.material=Array.isArray(child.material)?materials:materials[0];child.castShadow=false;child.receiveShadow=false;
  }});return copy;
 },[loaded]);
 useEffect(()=>()=>{object?.traverse(child=>{if(child instanceof Mesh){for(const m of Array.isArray(child.material)?child.material:[child.material])m.dispose();}});},[object]);
 useEffect(()=>{object?.traverse(o=>{if(o instanceof Mesh){o.renderOrder=xray?3:0;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.transparent!==xray){m.transparent=xray;m.needsUpdate=true;}m.opacity=xray?bodyOpacity:1;m.depthWrite=!xray;m.userData.xrayUniform.value=xray?1:0;}}});invalidate();},[object,xray,bodyOpacity,invalidate]);
 useEffect(()=>{setHovered(null);},[loaded,showMarkers,interactive,viewVersion]);
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
 const visible=(event:ThreeEvent<MouseEvent|PointerEvent>,anchor:AcupointAnchor)=>{
  if(!interactive)return false;
  const normal=new Vector3().fromArray(anchor.outwardNormal),towardCamera=event.ray.origin.clone().sub(new Vector3().fromArray(anchor.position));
  if(normal.dot(towardCamera)<=0)return false;
  const markerKey=anchor.knowledgeId+':'+anchor.side,center=new Vector3().fromArray(anchor.position);
  raycaster.set(event.ray.origin,center.clone().sub(event.ray.origin).normalize());
  const hits=[{kind:'marker' as const,distance:center.distanceTo(event.ray.origin),id:markerKey},...raycaster.intersectObjects(meshes,false).map(hit=>({kind:'body' as const,distance:hit.distance}))];
  return nearestVisibleMarker(hits)===markerKey;
 };
 const choose=(event:ThreeEvent<MouseEvent>,anchor:AcupointAnchor)=>{if(event.delta>4||!visible(event,anchor))return;event.stopPropagation();setHovered(null);onSelect({knowledgeId:anchor.knowledgeId,side:anchor.side});};
 const enter=(event:ThreeEvent<PointerEvent>,anchor:AcupointAnchor)=>{if(!visible(event,anchor))return;event.stopPropagation();setHovered(anchor.knowledgeId+':'+anchor.side);};
 useEffect(()=>{gl.domElement.style.cursor=hovered?'pointer':'grab';return()=>{gl.domElement.style.cursor='';};},[hovered,gl]);
 return <>
  <ambientLight intensity={.65}/><hemisphereLight args={['#e6efdd','#102c25',1.3]}/>
  <directionalLight position={[-2,3,3]} intensity={2} color="#f7ecd2"/><directionalLight position={[2,2,-2]} intensity={2.6} color="#7eb9a4"/><directionalLight position={[2,.6,2]} intensity={.7} color="#c7e3d5"/>
  {object&&<primitive object={object} onClick={(e:ThreeEvent<MouseEvent>)=>e.stopPropagation()}/>}
  {object&&xray&&showOrgans&&<Organs variant={loaded!.variant} onLoad={onOrganLoad}/>}
  {object&&xray&&showMeridians&&<MeridianNetwork variant={loaded!.variant}/>}
  {object&&showMarkers&&anchors.map((anchor,index)=>{const key=anchor.knowledgeId+':'+anchor.side;return <AcupointGlow key={key} anchor={anchor} texture={glow} index={index} selected={anchor===activeAnchor} hovered={hovered===key} name={pointNames[anchor.knowledgeId]??''} code={definitions.find(d=>d.knowledgeId===anchor.knowledgeId)?.referenceCode??''} onEnter={e=>enter(e,anchor)} onLeave={()=>setHovered(current=>current===key?null:current)} onChoose={e=>choose(e,anchor)}/>;})}
  <AtlasStage/>
  <GentleMotion/>
  <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.09} enablePan minDistance={.18} maxDistance={6} minPolarAngle={.06} maxPolarAngle={Math.PI-.06} target={[0,.89,0]} onStart={()=>{flight.current=null;setHovered(null);}}/>
 </>;
}

function AtlasStage(){
 return <group>
  {[.42,.51,.56].map((r,i)=><mesh key={r} position={[0,-.004+i*.001,0]} rotation={[-Math.PI/2,0,0]} raycast={()=>null}><ringGeometry args={[r,r+.0013,128]}/><meshBasicMaterial color="#c5ac65" transparent opacity={.28-i*.05} depthWrite={false}/></mesh>)}
  <mesh position={[0,.89,-.27]} raycast={()=>null}><ringGeometry args={[.88,.881,160]}/><meshBasicMaterial color="#bba15b" transparent opacity={.14} depthWrite={false}/></mesh>
 </group>;
}
// Keep the particle shimmer gentle, pause while hidden, and respect reduced motion.
function GentleMotion(){
 const invalidate=useThree(s=>s.invalidate);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');let timer:ReturnType<typeof setInterval>|undefined;
  const update=()=>{clearInterval(timer);timer=undefined;if(!document.hidden&&!media.matches)timer=setInterval(invalidate,60);};
  update();document.addEventListener('visibilitychange',update);media.addEventListener('change',update);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);media.removeEventListener('change',update);};
 },[invalidate]);return null;
}
