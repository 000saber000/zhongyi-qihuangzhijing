import {type ReactNode} from 'react';
import {Canvas} from '@react-three/fiber';
import UniverseScene from './UniverseScene';

type UniverseCanvasProps={
 active:boolean;
 reading:boolean;
 selected:string|null;
 filter:string;
 select:(id:string)=>void;
 showLines:boolean;
 reset:number;
 zoom:number;
 onReady:()=>void;
 quality:'high'|'low';
 fallback:ReactNode;
};

export default function UniverseCanvas({quality,fallback,active,...scene}:UniverseCanvasProps){
 return <Canvas frameloop={active?'always':'demand'} camera={{position:[1500,3900,6500],fov:51,near:1,far:26000}} dpr={[1,quality==='high'?1.5:1]} gl={{antialias:false,alpha:false,powerPreference:'high-performance'}} fallback={fallback}>
  <UniverseScene {...scene}/>
 </Canvas>;
}
