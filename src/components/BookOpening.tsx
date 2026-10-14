import {useLayoutEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import type {Knowledge} from '../data/catalog';
import {KnowledgeArtwork,getEntryKind} from './KnowledgeArtwork';

export type BookSelection={item:Knowledge;origin:DOMRect;saved:boolean};

export default function BookOpening({selection,onReveal,onFinish,onCancel}:{selection:BookSelection;onReveal:()=>Promise<void>;onFinish:()=>void;onCancel:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),stage=useRef<HTMLDivElement>(null);
 const kind=getEntryKind(selection.item)!;
 const callbacks=useRef({onReveal,onFinish});callbacks.current={onReveal,onFinish};
 useLayoutEffect(()=>{
  const modal=dialog.current!,element=stage.current!,art=element.querySelector<HTMLElement>('.knowledge-artwork')!;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const animations:Animation[]=[];let disposed=false,finished=false,handoff:Promise<void>|null=null;
  const width=Math.min(330,innerWidth*.66,(innerHeight-160)*.75),height=width*4/3;
  element.style.width=`${width}px`;element.style.height=`${height}px`;
  modal.showModal();
  const target=element.getBoundingClientRect(),source=selection.origin;
  const from=`translate(${source.x+source.width/2-target.x-width/2}px,${source.y+source.height/2-target.y-height/2}px) scale(${source.width/width},${source.height/height})`;
  const spreadScale=Math.min(1,(innerWidth-40)/(2*width+12));
  const spread=kind==='book'?`translateX(${-width*spreadScale/2}px) scale(${spreadScale})`:'scale(1.08)';
  let fillScale=Math.max(innerWidth/(width-10),innerHeight/(height-10))*1.08;
  let fill=`translate(0,0) scale(${fillScale})`;
  // Spatial entries settle on their illuminated landmark as the artwork grows.
  const focus=art.querySelector('.meridian-focus,.acupoint-focus');
  if((kind==='meridian'||kind==='acupoint')&&focus){
   const point=focus.getBoundingClientRect(),x=point.x+point.width/2-target.x,y=point.y+point.height/2-target.y;
   fillScale=Math.max(innerWidth/Math.max(20,2*Math.min(x,width-x)-10),innerHeight/Math.max(20,2*Math.min(y,height-y)-10))*1.08;
   fill=`translate(${(width/2-x)*fillScale}px,${(height/2-y)*fillScale}px) scale(${fillScale})`;
  }
  const animate=(node:Element,frames:Keyframe[],options:KeyframeAnimationOptions)=>{
   const animation=node.animate(frames,{fill:'forwards',...options});animations.push(animation);return animation.finished;
  };
  const trace=(path:SVGPathElement)=>{
   const length=path.getTotalLength();
   return animate(path,[{strokeDasharray:`${length} ${length}`,strokeDashoffset:length},{strokeDasharray:`${length} ${length}`,strokeDashoffset:0}],{duration:650,easing:'ease-in-out'});
  };
  const reveal=()=>handoff??=(callbacks.current.onReveal());
  const finish=()=>{if(!disposed&&!finished){finished=true;callbacks.current.onFinish();}};
  const complete=async()=>{if(disposed)return;await reveal();finish();};
  const motionChanged=()=>{if(motion.matches)void complete();};
  motion.addEventListener('change',motionChanged);
  const run=async()=>{
   try{
    if(motion.matches||typeof element.animate!=='function'){await complete();return;}
    const effects:Promise<Animation>[]=[];
    if(kind==='book'){
     effects.push(animate(art.querySelector('.book-front')!,[{transform:'rotateY(0deg)'},{transform:'rotateY(178deg)'}],{duration:1250,easing:'cubic-bezier(.4,0,.2,1)'}));
     art.querySelectorAll('.book-turning-page').forEach((page,index)=>effects.push(animate(page,[{transform:'rotateY(0deg)'},{transform:`rotateY(${174-index*4}deg)`}],{duration:1050,delay:60+index*80,easing:'cubic-bezier(.4,0,.2,1)'})));
    }else if(kind==='herb'){
     effects.push(animate(art.querySelector('.specimen-plant')!,[{transform:'scale(1)'},{transform:'translateX(3%) scale(1.08)'}],{duration:750,easing:'ease-out'}));
     art.querySelectorAll<SVGPathElement>('.specimen-veins path').forEach(path=>effects.push(trace(path)));
    }else if(kind==='formula'){
     ['left','right'].forEach((side,index)=>effects.push(animate(art.querySelector(`.formula-${side}`)!,[{transform:`rotateY(${index?26:-26}deg)`},{transform:'rotateY(0deg)'}],{duration:650,easing:'cubic-bezier(.2,.7,.2,1)'})));
     effects.push(animate(art.querySelector('.formula-links')!,[{opacity:.25},{opacity:1}],{duration:650}));
    }else if(kind==='meridian'){
     effects.push(trace(art.querySelector<SVGPathElement>('.meridian-route')!));
     effects.push(animate(art.querySelector('.meridian-pulse')!,[{opacity:.2,transform:'scale(.65)'},{opacity:1,transform:'scale(1.4)'},{opacity:.4,transform:'scale(1)'}],{duration:800}));
    }else if(kind==='theory'){
     effects.push(animate(art.querySelector('.jade-halves')!,[{transform:'rotate(0deg)'},{transform:'rotate(24deg)'}],{duration:750,easing:'ease-in-out'}));
     effects.push(animate(art.querySelector('.jade-orbit')!,[{transform:'rotate(0deg)'},{transform:'rotate(-12deg)'}],{duration:750,easing:'ease-out'}));
     ['yin','yang'].forEach((half,index)=>effects.push(animate(art.querySelector(`.jade-${half}`)!,[{transform:'translate(0,0)'},{transform:`translate(${index?14:-14}px,${index?8:-8}px)`}],{duration:750,easing:'ease-in-out'})));
    }else if(kind==='acupoint'){
     effects.push(animate(art.querySelector('.acupoint-ripple')!,[{opacity:.65,transform:'scale(.35)'},{opacity:.4,transform:'scale(2)',offset:.5},{opacity:0,transform:'scale(5.5)'}],{duration:950,easing:'ease-out'}));
     effects.push(animate(art.querySelector('.acupoint-glow')!,[{opacity:.6},{opacity:1,offset:.4},{opacity:.5}],{duration:850}));
    }else if(kind==='diagnosis'){
     art.querySelectorAll('.diagnosis-leaf').forEach((leaf,index)=>effects.push(animate(leaf,[
      {transform:`translateX(${(index-1.5)*8}%) rotate(${(index-1.5)*12}deg)`},
      {transform:`translateX(${(index-1.5)*48}%) rotate(${(index-1.5)*22}deg)`,offset:.45},
      {transform:'translateX(0) rotate(0deg)'}
     ],{duration:760,easing:'cubic-bezier(.3,.6,.2,1)'})));
     effects.push(animate(art.querySelector('.diagnosis-complete')!,[{opacity:0},{opacity:1}],{duration:250,delay:510}));
    }else if(kind==='physician'){
     effects.push(animate(art.querySelector('.physician-name-seal')!,[{transform:'translateY(-14px) rotate(-6deg) scale(1.16)',opacity:.5},{transform:'translateY(0) rotate(-6deg) scale(1)',opacity:1}],{duration:260,easing:'cubic-bezier(.3,.6,.2,1)'}));
     effects.push(animate(art.querySelector('.physician-ink')!,[{transform:'scale(.3)',opacity:0},{transform:'scale(1)',opacity:.7,offset:.45},{transform:'scale(2.2)',opacity:.3}],{duration:850,delay:180,easing:'ease-out'}));
     effects.push(animate(art.querySelector('.physician-portrait')!,[{opacity:1},{opacity:.35}],{duration:400,delay:450}));
    }
    await Promise.all([
     animate(element,[
      {transform:from,offset:0,easing:'cubic-bezier(.22,.6,.22,1)'},
      {transform:spread,offset:kind==='book'?.65:.5,easing:'cubic-bezier(.4,0,.18,1)'},
      {transform:fill,offset:1}
     ],{duration:kind==='book'?1900:1050,easing:'linear'}),
     ...effects,
     animate(element.querySelector('.book-opening-paper-veil')!,[{opacity:0},{opacity:1}],{duration:kind==='book'?450:350,delay:kind==='book'?1450:700}),
     animate(modal.querySelector('.book-opening-caption')!,[{opacity:1},{opacity:0}],{duration:kind==='book'?250:180,delay:kind==='book'?1000:600})
    ]);
    if(disposed)return;
    // Mount the destination before uncovering it, so the library never flashes back.
    await reveal();
    if(disposed)return;
    await animate(modal,[{opacity:1},{opacity:0}],{duration:kind==='book'?260:180,easing:'ease-out'});
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
 },[selection,kind]);
 const captions={book:['开卷','循经典之脉，入岐黄之境'],herb:['展标本','舒展叶脉，识本草之形'],formula:['启方笺','展开方笺，读配伍之意'],meridian:['循经络','金线引路，入经络之境'],theory:['观理象','阴阳舒展，循关系知理'],acupoint:['点星穴','涟漪引路，循部位而学'],diagnosis:['合诊笺','四诊相参，展开辨证之笺'],physician:['阅名家','名家留印，循生平知学']};
 return createPortal(<dialog ref={dialog} className="book-opening" data-kind={kind} aria-label={`正在${kind==='book'?'翻开':'打开'}《${selection.item.title}》`} aria-busy="true" onCancel={event=>{event.preventDefault();onCancel();}}>
  <button type="button" className="book-opening-close" onClick={onCancel} aria-label={kind==='book'?'取消翻书':'取消打开'}><X size={20}/></button>
  <div className="book-opening-stage" ref={stage}><KnowledgeArtwork item={selection.item} saved={selection.saved}/><div className="book-opening-paper-veil" aria-hidden="true"/></div>
  <p className="book-opening-caption">{captions[kind][0]} · {selection.item.title}<span>{captions[kind][1]}</span></p>
 </dialog>,document.body);
}
