import {useEffect,useRef} from 'react';
import {OrbitControls} from '@react-three/drei';
import {useFrame,useThree} from '@react-three/fiber';
import {EffectComposer,Bloom} from '@react-three/postprocessing';
import {OrbitControls as Controls} from 'three-stdlib';
import * as THREE from 'three';
import {Galaxy} from './Galaxy';
import KnowledgeStars from './KnowledgeStars';
import RelationLight from './RelationLight';
import KnowledgeClouds from './KnowledgeClouds';
import {nodeById} from './knowledgeSpace';
import {spinXZ} from './galaxyParams';
import {useStore} from '../state/store';
const HOME=new THREE.Vector3(1500,3900,6500);
function CameraRig({selected,reset,zoom,reading}:{selected:string|null;reset:number;zoom:number;reading:boolean}){
 const ref=useRef<Controls>(null);const target=useRef(new THREE.Vector3(-650,0,0));const desired=useRef(HOME.clone());const flying=useRef(true);const {camera}=useThree();const previousZoom=useRef(zoom);
 useEffect(()=>{const node=selected?nodeById.get(selected):null;if(node){const [x,z]=spinXZ(node.position[0],node.position[2]);target.current.set(x,node.position[1],z);desired.current.copy(target.current).add(new THREE.Vector3(600,1350,2400))}else{target.current.set(-650,0,0);desired.current.copy(HOME).multiplyScalar(reading?1.18:1)}flying.current=true},[selected,reset,reading]);
 useEffect(()=>{if(zoom!==previousZoom.current&&ref.current){const direction=camera.position.clone().sub(ref.current.target);direction.multiplyScalar(zoom>previousZoom.current?.79:1.27);desired.current.copy(ref.current.target).add(direction);target.current.copy(ref.current.target);flying.current=true;previousZoom.current=zoom}},[zoom,camera]);
 useFrame((_,dt)=>{if(!ref.current)return;const node=selected?nodeById.get(selected):null;if(node){const [x,z]=spinXZ(node.position[0],node.position[2]);const movement=new THREE.Vector3(x,node.position[1],z).sub(target.current);target.current.add(movement);desired.current.add(movement);if(!flying.current){camera.position.add(movement);ref.current.target.add(movement);ref.current.update()}}if(flying.current){const a=1-Math.exp(-Math.min(dt,.2)*3);camera.position.lerp(desired.current,a);ref.current.target.lerp(target.current,a);ref.current.update();if(camera.position.distanceTo(desired.current)<8)flying.current=false}});
 return <OrbitControls ref={ref} makeDefault enableDamping dampingFactor={.06} rotateSpeed={.45} zoomSpeed={.65} minDistance={750} maxDistance={16000} maxPolarAngle={Math.PI*.82} onStart={()=>{flying.current=false}} target={[-650,0,0]}/>;
}
export default function UniverseScene({selected,filter,select,showLines,reset,zoom,onReady,reading=false}:{reading?:boolean;selected:string|null;filter:string;select:(id:string)=>void;showLines:boolean;reset:number;zoom:number;onReady:()=>void}){
 const quality=useStore(s=>s.quality);const ready=useRef(false);const frames=useRef(0);
 useFrame(()=>{frames.current++;if(!ready.current&&frames.current>=3){ready.current=true;onReady()}});
 return <><color attach="background" args={['#070e12']}/><Galaxy/><KnowledgeClouds selected={selected} filter={filter}/>{!reading&&<KnowledgeStars selected={selected} filter={filter} select={select}/>}<RelationLight selected={selected} show={showLines}/><CameraRig reading={reading} selected={selected} reset={reset} zoom={zoom}/>{quality==='high'&&<EffectComposer multisampling={0}><Bloom intensity={.9} luminanceThreshold={.55} luminanceSmoothing={.7} mipmapBlur/></EffectComposer>}</>
}
