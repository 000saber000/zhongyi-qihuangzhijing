import {useLayoutEffect,useRef,useState} from 'react';
import {ArrowUpRight,BookOpen,Bookmark,ChevronRight,Sparkles,X} from 'lucide-react';
import {categoryLabel,knowledge,keyPoints,type Knowledge} from '../../data/catalog';
import {fieldColors,nodeById} from '../../three/knowledgeSpace';

// Retain the outgoing content until its animation finishes. Selection and camera
// updates remain immediate; interrupted animations can never commit stale content.
function usePanelTransition(next:Knowledge|null){
 const shell=useRef<HTMLElement>(null),content=useRef<HTMLDivElement>(null);
 const current=useRef<Knowledge|null>(null);
 const [displayed,setDisplayed]=useState<Knowledge|null>(null);
 useLayoutEffect(()=>{
  const panel=shell.current!,body=content.current!;
  const previous=current.current;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed=false,immediate=false,animation:Animation|null=null;
  const commit=()=>{
   current.current=next;setDisplayed(next);panel.hidden=!next;
   panel.toggleAttribute('inert',false);
   if(next&&previous?.id!==next.id)panel.scrollTop=0;
  };
  const settle=()=>{immediate=true;animation?.cancel();commit();};
  const motionChanged=()=>{if(motion.matches)settle();};
  const animate=async(element:HTMLElement,frames:Keyframe[],duration:number)=>{
   animation=element.animate(frames,{duration,easing:'cubic-bezier(.22,.7,.2,1)',fill:'forwards'});
   await animation.finished;animation.cancel();animation=null;
  };
  motion.addEventListener('change',motionChanged);
  const run=async()=>{
   if(previous?.id===next?.id||motion.matches||typeof panel.animate!=='function'){commit();return;}
   try{
    if(previous){
     panel.toggleAttribute('inert',true);
     await animate(next?body:panel,[{opacity:1,transform:'none'},{opacity:0,transform:'none'}],next?90:160);
     if(disposed||immediate)return;
    }
    commit();
    if(next)await animate(previous?body:panel,[{opacity:0,transform:previous?'none':'translateX(16px)'},{opacity:1,transform:'none'}],previous?140:240);
   }catch{
    if(!disposed&&!immediate)commit();
   }
  };
  void run();
  return()=>{disposed=true;motion.removeEventListener('change',motionChanged);animation?.cancel();panel.toggleAttribute('inert',false);};
 },[next]);
 return {item:displayed,shell,content};
}

type Props={item:Knowledge|null;bookmarks:string[];studyReady:boolean;pendingBookmarks:Set<string>;onToggle:(id:string)=>void;onSelect:(id:string)=>void;onClose:()=>void;onNavigate:(route:string)=>void;onExplain?:(item:Knowledge)=>void};
export default function KnowledgePanel({item:next,bookmarks,studyReady,pendingBookmarks,onToggle,onSelect:select,onClose:clear,onNavigate,onExplain}:Props){
 const {item,shell,content}=usePanelTransition(next);
 return <aside ref={shell} className="cosmic-panel" aria-label="知识详情" aria-hidden={!next} hidden={!item}><div ref={content} className="panel-content">{item&&<>
<div className="panel-top"><span><i style={{background:fieldColors[item.type]}}/>{categoryLabel(item.type)} · KNOWLEDGE STAR</span><button onClick={clear} aria-label="关闭知识详情"><X size={19}/></button></div>
 <div className="panel-title"><span className="panel-no">NO. {String(knowledge.findIndex(k=>k.id===item.id)+1).padStart(3,'0')}</span><h2>{item.title}</h2><p>{item.subtitle}</p></div>
 <div className="panel-tags">{item.tags.map(t=><span key={t}>{t}</span>)}</div>
 <div className="panel-divider"><span>知识导读</span><i/></div><p className="panel-summary">{item.summary}</p>{keyPoints[item.id]&&<div className="panel-points">{keyPoints[item.id].slice(0,2).map((p,i)=><p key={p}><span>0{i+1}</span>{p}</p>)}</div>}<div className="panel-divider"><span>关联星辰</span><i/><small>{item.relations.length}</small></div>
 <div className="panel-relations">{item.relations.map(id=>{const related=nodeById.get(id)?.item;return related&&<button key={id} onClick={()=>select(id)} aria-label={`关联知识 ${related.title}`}><i style={{background:fieldColors[related.type]}}/><span>{related.title}<small>{categoryLabel(related.type)}</small></span><ChevronRight size={14}/></button>})}</div>
 {onExplain&&<button className="ai-explain" onClick={()=>onExplain(item)}><Sparkles size={14}/>请 AI 讲解</button>}
 <div className="panel-source"><BookOpen size={13}/><div>{item.source}<small>用户提供素材 · 具体出处待核对</small></div></div>
 <div className="panel-bottom"><button className={bookmarks.includes(item.id)?'saved':''} disabled={!studyReady||pendingBookmarks.has('bookmark:'+item.id)} onClick={()=>onToggle(item.id)} aria-label={bookmarks.includes(item.id)?'取消收藏':'收藏知识'}><Bookmark size={15} fill={bookmarks.includes(item.id)?'currentColor':'none'}/>{bookmarks.includes(item.id)?'已收入书斋':'收藏知识'}</button><button onClick={()=>onNavigate(`knowledge/${item.id}`)}>深入研读 <ArrowUpRight size={14}/></button></div>
 </>}</div></aside>;
}
