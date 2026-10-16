import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,Check,Pause,Play} from 'lucide-react';
import {courses,type Course} from '../../data/catalog';
import CardSwap,{Card,type CardSwapHandle} from '../../components/react-bits/CardSwap';
import foundationImage from '../../assets/courses/foundation.webp';
import classicsImage from '../../assets/courses/classics.webp';
import meridiansImage from '../../assets/courses/meridians.webp';
import {courseBookTitle} from './courseTitle';
import useReducedMotion from './useReducedMotion';
import './course-deck.css';

const artwork=[
 {src:foundationImage,alt:'墨绿山水间的阴阳玉盘与五行轨迹'},
 {src:classicsImage,alt:'云山前展开的中医古籍与本草图绘'},
 {src:meridiansImage,alt:'玉雕人像上的金色经络意象'}
];
type Props={completed:string[];paused:boolean;activeCourse:string|null;onStart:(course:Course,index:number,trigger:HTMLElement)=>void;onHighlight:(id:string|null)=>void;onFocus:(id:string|null)=>void};
export default function CourseDeck({completed,paused,activeCourse,onStart,onHighlight,onFocus}:Props){
 const deck=useRef<CardSwapHandle>(null),host=useRef<HTMLDivElement>(null);
 const [current,setCurrent]=useState(0),[held,setHeld]=useState(false),[focused,setFocused]=useState(false),[width,setWidth]=useState(420);
 const reduced=useReducedMotion();
 useEffect(()=>{
  const element=host.current!;
  const observer=new ResizeObserver(()=>setWidth(Math.max(240,Math.min(420,element.clientWidth-48))));
  observer.observe(element);return()=>observer.disconnect();
 },[]);
 return <div className="course-deck" aria-label="选择学习路径"
  onPointerEnter={event=>{if(event.pointerType==='mouse')onHighlight(courses[current].id);}}
  onPointerLeave={()=>onHighlight(null)}
  onFocusCapture={event=>{setFocused(true);if(event.target.matches(':focus-visible'))onFocus((event.target as HTMLElement).dataset.courseId??courses[current].id);}}
  onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setFocused(false);onFocus(null);}}}>
  <div className="course-deck-heading"><h2>选一卷，循序而学。</h2></div>
  <div className="course-deck-stage" ref={host}>
   <CardSwap ref={deck} aria-label="课程卡片轮播" width={width} height={width<340?440:420} cardDistance={width<340?24:38} verticalDistance={32} depth={60} skewAmount={3}
    visibleCards={3} delay={6500} autoplay={!paused&&!held&&!focused&&!activeCourse&&!reduced} pauseOnHover draggable={!reduced}
    intro={!reduced} parallax={.06} hoverSpread={.05} bounce={.18} dim={.38} cardRadius={16} onChange={setCurrent}>
    {courses.map((course,index)=>{
     const count=course.lessons.filter((_,i)=>completed.includes(`${course.id}-${i}`)).length;
     return <Card key={course.id} className="course-choice-glow course-deck-card" data-course-id={course.id}>
      <div className="course-deck-card-top"><span>{course.glyph}</span><span>{course.level} · {course.lessons.length} 个单元</span><span>{index+1} / {courses.length}</span></div>
      <img className="course-deck-art" src={artwork[index].src} alt={artwork[index].alt} draggable={false}/>
      <div className="course-deck-body"><h3>{courseBookTitle(course)}</h3><p>{course.desc}</p>
       <div className="course-orbit-nodes" aria-label={`${course.title}学习节点`}>{course.lessons.map((title,i)=><span className={completed.includes(`${course.id}-${i}`)?'done':''} key={title} title={title}><i>{completed.includes(`${course.id}-${i}`)?<Check size={11}/>:i+1}</i></span>)}</div>
       <div className="course-deck-action"><span className="course-orbit-count">{count?`${count} / ${course.lessons.length} 单元已完成`:'开启你的学习之旅'}</span>
        <button type="button" data-course-id={course.id} tabIndex={current===index?0:-1} aria-label={`开始学习 ${course.title}`} onClick={event=>onStart(course,index,event.currentTarget)}>{count?'继续学习':'开始学习'}<ArrowUpRight size={16}/></button></div>
       <div className="course-orbit-progress" role="progressbar" aria-label={`${courseBookTitle(course)}进度`} aria-valuemin={0} aria-valuemax={course.lessons.length} aria-valuenow={count}><i style={{width:`${count/course.lessons.length*100}%`}}/></div>
      </div>
     </Card>;
    })}
   </CardSwap>
  </div>
  <div className="course-deck-controls"><span aria-live="polite">{courseBookTitle(courses[current])}<small>{current+1} / {courses.length}</small></span><div>
   <button type="button" aria-label="上一门课程" onClick={()=>deck.current?.prev()}><ArrowLeft size={18}/></button>
   <button type="button" aria-label={held?'继续卡片轮播':'暂停卡片轮播'} disabled={reduced} onClick={()=>setHeld(!held)}>{held||reduced?<Play size={15}/>:<Pause size={15}/>}</button>
   <button type="button" aria-label="下一门课程" onClick={()=>deck.current?.next()}><ArrowRight size={18}/></button>
  </div></div>
  <p className="course-deck-hint">拖动卡片切换课程 · 聚焦时暂停轮播</p>
 </div>;
}
