import {useEffect,useLayoutEffect,useRef,type MutableRefObject,type ReactNode} from 'react';

type Props={children:ReactNode;onClosed:()=>void;closeRef:MutableRefObject<(()=>void)|null>;origin:HTMLElement|null;trigger:HTMLElement|null;opening:boolean};
export default function LessonModalFrame({children,onClosed,closeRef,origin,trigger,opening}:Props){
 const panel=useRef<HTMLElement>(null);
 const closed=useRef(onClosed);closed.current=onClosed;
 const runClose=useRef<()=>void>(()=>{});
 useLayoutEffect(()=>{
  const element=panel.current!;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let disposed=false,closing=false,animation:Animation|null=null;
  const finish=()=>{if(!disposed)closed.current();};
  const close=()=>{
   if(closing)return;closing=true;
   const source=element.getBoundingClientRect(),target=origin?.isConnected?origin.getBoundingClientRect():null;
   if(motion.matches||typeof element.animate!=='function'){finish();return;}
   const transform=target?`translate(${target.x+target.width/2-source.x-source.width/2}px,${target.y+target.height/2-source.y-source.height/2}px) scale(${target.width/source.width},${target.height/source.height})`:'translateY(12px) scale(.98)';
   element.toggleAttribute('inert',true);
   animation=element.animate([{opacity:1,transform:'none'},{opacity:0,transform}],{duration:300,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
   void animation.finished.then(finish,()=>{if(!disposed)finish();});
  };
  const changed=()=>{if(motion.matches&&closing){animation?.cancel();finish();}};
  runClose.current=close;closeRef.current=close;
  motion.addEventListener('change',changed);
  return()=>{
   disposed=true;motion.removeEventListener('change',changed);animation?.cancel();
   if(closeRef.current===close)closeRef.current=null;
   const focusTarget=trigger?.isConnected?trigger:origin?.isConnected?origin:null;
   focusTarget?.focus({preventScroll:true});
  };
 },[origin,trigger,closeRef]);
 useEffect(()=>{
  if(!opening){const heading=panel.current?.querySelector<HTMLElement>('h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
 },[opening]);
 return <div aria-hidden={opening||undefined} className="modal-overlay course-lesson-overlay" onClick={()=>runClose.current()}>
  <section ref={panel} className="lesson-modal course-lesson-modal" role="dialog" aria-modal="true" aria-labelledby="lesson-title" onClick={event=>event.stopPropagation()} onKeyDown={event=>{
   if(event.key!=='Tab')return;
   const controls=Array.from(panel.current!.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]'));
   const first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&(document.activeElement===first||!controls.includes(document.activeElement as HTMLElement))){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!controls.includes(document.activeElement as HTMLElement))){event.preventDefault();first?.focus();}
  }}>{children}</section>
 </div>;
}
