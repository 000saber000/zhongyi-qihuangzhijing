import {useLayoutEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {courseBookTitle} from './courseTitle';
import type {CourseSelection,CourseVisualRef} from './sceneTypes';
export type {CourseSelection} from './sceneTypes';

type Props={selection:CourseSelection;visual:CourseVisualRef;onReveal:()=>Promise<void>;onFinish:()=>void;onCancel:()=>void};
export default function CourseOpening({selection,visual,onReveal,onFinish,onCancel}:Props){
 const stage=useRef<HTMLDivElement>(null);
 const callbacks=useRef({onReveal,onFinish});callbacks.current={onReveal,onFinish};
 useLayoutEffect(()=>{
  const modal=visual.current!.layer,element=stage.current!,motion=matchMedia('(prefers-reduced-motion: reduce)');
  let disposed=false,finished=false,handoff:Promise<void>|null=null,fade:Animation|null=null;
  modal.setAttribute('aria-label',`正在翻开课程《${courseBookTitle(selection.course)}》`);modal.setAttribute('aria-busy','true');
  const canceled=(event:Event)=>{event.preventDefault();onCancel();};modal.addEventListener('cancel',canceled);
  const opening=visual.current?.open(selection,element);
  const reveal=()=>handoff??=callbacks.current.onReveal();
  const finish=()=>{if(!disposed&&!finished){finished=true;callbacks.current.onFinish();}};
  const complete=async()=>{if(disposed)return;await reveal();finish();};
  const changed=()=>{if(motion.matches)void complete();};motion.addEventListener('change',changed);
  const run=async()=>{
   try{
    if(motion.matches||!opening){await complete();return;}
    await opening.finished;if(disposed||finished)return;await reveal();if(disposed||finished)return;
    fade=modal.animate([{opacity:1},{opacity:0}],{duration:180,easing:'ease-out',fill:'forwards'});
    await fade.finished;finish();
   }catch{if(!disposed&&!finished)await complete();}
  };
  void run();
  return()=>{disposed=true;motion.removeEventListener('change',changed);modal.removeEventListener('cancel',canceled);fade?.cancel();opening?.cancel();if(!finished&&selection.trigger.isConnected)selection.trigger.focus({preventScroll:true});};
 },[selection,visual]);
 const layer=visual.current?.layer;
 if(!layer)return null;
 return createPortal(<div className="course-opening-stage" ref={stage}>
  <button className="course-opening-close" type="button" aria-label="取消翻开课程" onClick={onCancel}><X size={21}/></button>
  <p className="course-opening-caption">开卷 · {courseBookTitle(selection.course)}<span>从一卷医理，走进一片星海</span></p>
 </div>,layer);
}
