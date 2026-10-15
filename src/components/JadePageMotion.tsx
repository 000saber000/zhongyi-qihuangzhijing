import {useRef} from 'react';
import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {useGSAP} from '@gsap/react';
import type {ReactNode} from 'react';

gsap.registerPlugin(ScrollTrigger,useGSAP);

export default function JadePageMotion({children}:{children:ReactNode}){
 const scope=useRef<HTMLDivElement>(null);
 useGSAP(()=>{
  const scroller=scope.current?.parentElement;
  if(!scroller)return;
  const media=gsap.matchMedia();
  media.add('(prefers-reduced-motion: no-preference)',()=>{
   const targets=scope.current?.querySelectorAll<HTMLElement>('.study-resume-content,.account-card,.study-stats > div,.section-head,.knowledge-grid > .knowledge-card');
   targets?.forEach(target=>gsap.from(target,{
    y:16,autoAlpha:0,duration:.56,ease:'power2.out',
    scrollTrigger:{trigger:target,scroller,start:'top 96%',toggleActions:'play none none none',once:true}
   }));
  });
  return()=>media.revert();
 },{scope,dependencies:[],revertOnUpdate:true});
 return <div className="jade-motion-scope" ref={scope}>{children}</div>;
}
