import {useLayoutEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import type {Knowledge} from '../data/catalog';
import {AntiqueBook} from './AntiqueBook';

export type BookSelection={item:Knowledge;origin:DOMRect;saved:boolean};

export default function BookOpening({selection,onReveal,onFinish,onCancel}:{selection:BookSelection;onReveal:()=>Promise<void>;onFinish:()=>void;onCancel:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),stage=useRef<HTMLDivElement>(null);
 const callbacks=useRef({onReveal,onFinish});callbacks.current={onReveal,onFinish};
 useLayoutEffect(()=>{
  const modal=dialog.current!,element=stage.current!,book=element.querySelector<HTMLElement>('.antique-book')!;
  const cover=book.querySelector<HTMLElement>('.book-front')!;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const animations:Animation[]=[];let disposed=false,finished=false,handoff:Promise<void>|null=null;
  const width=Math.min(330,innerWidth*.66,(innerHeight-160)*.75),height=width*4/3;
  element.style.width=`${width}px`;element.style.height=`${height}px`;
  modal.showModal();
  const target=element.getBoundingClientRect(),source=selection.origin;
  const from=`translate(${source.x+source.width/2-target.x-width/2}px,${source.y+source.height/2-target.y-height/2}px) scale(${source.width/width},${source.height/height})`;
  const spreadScale=Math.min(1,(innerWidth-40)/(2*width+12));
  const spread=`translateX(${-width*spreadScale/2}px) scale(${spreadScale})`;
  // Finish inside the left-hand page, with its edges outside the viewport.
  const fillScale=Math.max(innerWidth/(width-10),innerHeight/(height-10))*1.08;
  const fill=`translate(0,0) scale(${fillScale})`;
  const animate=(node:HTMLElement,frames:Keyframe[],options:KeyframeAnimationOptions)=>{
   const animation=node.animate(frames,{fill:'forwards',...options});animations.push(animation);return animation.finished;
  };
  const reveal=()=>handoff??=(callbacks.current.onReveal());
  const finish=()=>{if(!disposed&&!finished){finished=true;callbacks.current.onFinish();}};
  const complete=async()=>{if(disposed)return;await reveal();finish();};
  const motionChanged=()=>{if(motion.matches)void complete();};
  motion.addEventListener('change',motionChanged);
  const run=async()=>{
   try{
    if(motion.matches||typeof element.animate!=='function'){await complete();return;}
    await Promise.all([
     animate(element,[
      {transform:from,offset:0,easing:'cubic-bezier(.22,.6,.22,1)'},
      {transform:spread,offset:.65,easing:'cubic-bezier(.4,0,.18,1)'},
      {transform:fill,offset:1}
     ],{duration:2600,easing:'linear'}),
     animate(cover,[{transform:'rotateY(0deg)'},{transform:'rotateY(178deg)'}],{duration:1700,easing:'cubic-bezier(.4,0,.2,1)'}),
     ...Array.from(book.querySelectorAll<HTMLElement>('.book-turning-page')).map((page,index)=>animate(page,[{transform:'rotateY(0deg)'},{transform:`rotateY(${174-index*4}deg)`}],{duration:1450,delay:100+index*120,easing:'cubic-bezier(.4,0,.2,1)'})),
     animate(element.querySelector<HTMLElement>('.book-opening-paper-veil')!,[{opacity:0},{opacity:1}],{duration:600,delay:2000}),
     animate(modal.querySelector<HTMLElement>('.book-opening-caption')!,[{opacity:1},{opacity:0}],{duration:350,delay:1500})
    ]);
    if(disposed)return;
    // Mount the destination before uncovering it, so the library never flashes back.
    await reveal();
    if(disposed)return;
    await animate(modal,[{opacity:1},{opacity:0}],{duration:440,easing:'ease-out'});
    finish();
   }catch{
    // Cancellation rejects finished promises; an unavailable animation falls back to reading.
    await complete();
   }
  };
  void run();
  return()=>{
   disposed=true;motion.removeEventListener('change',motionChanged);
   animations.forEach(animation=>animation.cancel());modal.close();
  };
 },[selection]);
 return createPortal(<dialog ref={dialog} className="book-opening" aria-label={`正在翻开《${selection.item.title}》`} aria-busy="true" onCancel={event=>{event.preventDefault();onCancel();}}>
  <button type="button" className="book-opening-close" onClick={onCancel} aria-label="取消翻书"><X size={20}/></button>
  <div className="book-opening-stage" ref={stage}><AntiqueBook item={selection.item} saved={selection.saved}/><div className="book-opening-paper-veil" aria-hidden="true"/></div>
  <p className="book-opening-caption">开卷 · {selection.item.title}<span>循经典之脉，入岐黄之境</span></p>
 </dialog>,document.body);
}
