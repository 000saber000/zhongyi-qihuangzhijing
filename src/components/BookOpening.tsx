import {useLayoutEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import type {Knowledge} from '../data/catalog';
import {AntiqueBook} from './AntiqueBook';

export type BookSelection={item:Knowledge;origin:DOMRect;saved:boolean};

export default function BookOpening({selection,onFinish,onCancel}:{selection:BookSelection;onFinish:()=>void;onCancel:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),stage=useRef<HTMLDivElement>(null);
 const finish=useRef(onFinish);finish.current=onFinish;
 useLayoutEffect(()=>{
  const modal=dialog.current!,element=stage.current!,book=element.querySelector<HTMLElement>('.antique-book')!;
  const cover=book.querySelector<HTMLElement>('.book-front')!;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const animations:Animation[]=[];let disposed=false;
  // A single leaf grows first; the spread then fits even a narrow screen.
  const width=Math.min(330,innerWidth*.66,(innerHeight-160)*.75),height=width*4/3;
  element.style.width=`${width}px`;element.style.height=`${height}px`;
  modal.showModal();
  const target=element.getBoundingClientRect(),source=selection.origin;
  const from=`translate(${source.x+source.width/2-target.x-width/2}px,${source.y+source.height/2-target.y-height/2}px) scale(${source.width/width},${source.height/height})`;
  const spreadScale=Math.min(1,(innerWidth-40)/(2*width+12));
  const spread=`translateX(${-width*spreadScale/2}px) scale(${spreadScale})`;
  const animate=(node:HTMLElement,frames:Keyframe[],options:KeyframeAnimationOptions)=>{
   const animation=node.animate(frames,{fill:'forwards',...options});animations.push(animation);return animation.finished;
  };
  const complete=()=>{if(!disposed)finish.current();};
  const motionChanged=()=>{if(motion.matches)complete();};
  motion.addEventListener('change',motionChanged);
  const run=async()=>{
   try{
    if(motion.matches||typeof element.animate!=='function'){complete();return;}
    await animate(element,[{transform:from},{transform:'translate(0,0) scale(1)'}],{duration:640,easing:'cubic-bezier(.22,.7,.2,1)'});
    if(disposed)return;
    await Promise.all([
     animate(element,[{transform:'translate(0,0) scale(1)'},{transform:spread}],{duration:1850,easing:'cubic-bezier(.4,0,.2,1)'}),
     animate(cover,[{transform:'rotateY(0deg)'},{transform:'rotateY(178deg)'}],{duration:1850,easing:'cubic-bezier(.4,0,.2,1)'}),
     ...Array.from(book.querySelectorAll<HTMLElement>('.book-turning-page')).map((page,index)=>animate(page,[{transform:'rotateY(0deg)'},{transform:`rotateY(${174-index*4}deg)`}],{duration:1450,delay:220+index*160,easing:'cubic-bezier(.4,0,.2,1)'}))
    ]);
    if(disposed)return;
    complete();
   }catch{
    // Cancellation rejects finished promises; an unavailable animation falls back to reading.
    complete();
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
  <div className="book-opening-stage" ref={stage}><AntiqueBook item={selection.item} saved={selection.saved}/></div>
  <p className="book-opening-caption">开卷 · {selection.item.title}<span>循经典之脉，入岐黄之境</span></p>
 </dialog>,document.body);
}
