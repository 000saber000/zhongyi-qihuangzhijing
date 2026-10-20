import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronDown,GripVertical,MessageCircle,X} from 'lucide-react';
import type {Knowledge} from '../../data/catalog';
import './ai.css';

type PetCopy={greeting:string;prompts:string[]};
type Position={x:number;y:number};
const storageKey='qihuang-pet-position-v1';

function copyFor(route:string,context:Knowledge|null):PetCopy{
 if(context)return {greeting:`正在读《${context.title}》？我可以陪你理清重点。`,prompts:[`请用一个生活中的例子解释“${context.title}”`,`“${context.title}”和哪些知识最相关？`,`给我一道关于“${context.title}”的自测题`]};
 if(route.startsWith('universe/'))return {greeting:'星海里的每颗星都是一个知识点。要我带你顺着关系探索吗？',prompts:['怎样使用知识星图？','帮我从阴阳开始规划探索路线','知识之间的连线代表什么？']};
 if(route==='meridians')return {greeting:'经脉与穴位很多，先从一条循行路线开始会更清楚。',prompts:['十二经脉应该怎样入门？','穴位名称有什么记忆方法？','帮我规划一条经络学习路线']};
 if(route==='courses')return {greeting:'循序而学比一次记很多更有效。我可以帮你选择起点。',prompts:['我应该从哪门课程开始？','为我安排一条七天入门路径','怎样复习今天学过的内容？']};
 if(route==='library')return {greeting:'这里收着站内全部知识。说一个感兴趣的词，我帮你找入口。',prompts:['中医基础知识应该从哪里开始？','桂枝与白芍有什么联系？','推荐三个适合初学者的条目']};
 if(route==='study')return {greeting:'书斋记录着你的学习足迹。今天想继续读，还是先复习？',prompts:['怎样安排今天的学习？','帮我复习阴阳与五行','如何建立中医知识框架？']};
 return {greeting:'我是小岐。可以陪你看星图、识经穴、读典籍。',prompts:['带我认识这个网站','中医知识应该怎样入门？','推荐一条今天的学习路线']};
}

function clamp(position:Position){
 const width=window.innerWidth<640?76:112,height=window.innerWidth<640?92:126;
 return {x:Math.min(Math.max(8,position.x),Math.max(8,window.innerWidth-width-8)),y:Math.min(Math.max(72,position.y),Math.max(72,window.innerHeight-height-8))};
}

export default function QihuangPet({route,context,chatOpen,onOpen,onAsk}:{route:string;context:Knowledge|null;chatOpen:boolean;onOpen:()=>void;onAsk:(question:string)=>void}){
 const [hidden,setHidden]=useState(false),[bubble,setBubble]=useState(true),[position,setPosition]=useState<Position|null>(null),[dragging,setDragging]=useState(false);
 const drag=useRef<{id:number;dx:number;dy:number}|null>(null);
 const copy=useMemo(()=>copyFor(route,context),[route,context?.id]);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))setPosition(clamp(saved));}catch{}},[]);
 useEffect(()=>{const resize=()=>setPosition(value=>value?clamp(value):value);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 useEffect(()=>{if(!chatOpen)setBubble(true);},[route,context?.id]);
 if(hidden)return <button className="qihuang-pet-restore" onClick={()=>{setHidden(false);setBubble(true);}} aria-label="唤回小岐桌宠"><span>岐</span>唤回小岐</button>;
 const style=position?{left:position.x,top:position.y,right:'auto',bottom:'auto'}:undefined;
 return <aside className={`qihuang-pet${chatOpen?' is-chatting':''}${dragging?' is-dragging':''}`} style={style} aria-label="小岐学习桌宠">
  {bubble&&!chatOpen&&<div className="qihuang-pet-bubble" role="status">
   <div className="qihuang-pet-bubble-head"><b>小岐伴读</b><button aria-label="收起小岐提示" onClick={()=>setBubble(false)}><ChevronDown size={15}/></button></div>
   <p>{copy.greeting}</p>
   <div className="qihuang-pet-prompts">{copy.prompts.map(question=><button key={question} onClick={()=>onAsk(question)}>{question}</button>)}</div>
  </div>}
  <div className="qihuang-pet-controls">
   <button className="qihuang-pet-drag" aria-label="拖动小岐桌宠" title="拖动位置" onPointerDown={event=>{
    if(event.button!==0)return;const box=event.currentTarget.closest('.qihuang-pet')?.getBoundingClientRect();if(!box)return;
    drag.current={id:event.pointerId,dx:event.clientX-box.left,dy:event.clientY-box.top};event.currentTarget.setPointerCapture(event.pointerId);setDragging(true);
   }} onPointerMove={event=>{if(!drag.current||drag.current.id!==event.pointerId)return;setPosition(clamp({x:event.clientX-drag.current.dx,y:event.clientY-drag.current.dy}));}} onPointerUp={event=>{
    if(!drag.current||drag.current.id!==event.pointerId)return;event.currentTarget.releasePointerCapture(event.pointerId);setDragging(false);drag.current=null;setPosition(value=>{if(value)localStorage.setItem(storageKey,JSON.stringify(value));return value;});
   }}><GripVertical size={15}/></button>
   <button aria-label="暂时隐藏小岐桌宠" title="隐藏桌宠" onClick={()=>setHidden(true)}><X size={14}/></button>
  </div>
  <button className="qihuang-pet-character" aria-label="问岐黄" aria-expanded={chatOpen} onClick={onOpen}>
   <span className="qihuang-pet-halo"/><span className="qihuang-pet-hat"><i/></span>
   <span className="qihuang-pet-head"><i className="eye left"/><i className="eye right"/><i className="mouth"/></span>
   <span className="qihuang-pet-body"><i className="qihuang-pet-book"><em>岐</em></i></span><span className="qihuang-pet-shadow"/>
   <span className="qihuang-pet-action"><MessageCircle size={14}/>{chatOpen?'正在答疑':'问小岐'}</span>
  </button>
 </aside>;
}
