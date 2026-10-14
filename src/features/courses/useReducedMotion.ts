import {useEffect,useState} from 'react';

export default function useReducedMotion(){
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>setReduced(media.matches);
  media.addEventListener('change',update);update();
  return()=>media.removeEventListener('change',update);
 },[]);
 return reduced;
}
