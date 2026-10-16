import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {Pause,Play} from 'lucide-react';
import {courses,type Course} from '../../data/catalog';
import {courseBookTitle} from './courseTitle';
import type {CourseVisualRef} from './sceneTypes';
import CourseDeck from './CourseDeck';
const CourseScene=lazy(()=>import('./CourseScene'));
import useReducedMotion from './useReducedMotion';
import './courses.css';

type Props={completed:string[];activeCourse:string|null;onStart:(course:Course,origin:HTMLElement,trigger:HTMLElement)=>void;visual:CourseVisualRef};
export default function CourseOrbit({completed,activeCourse,onStart,visual}:Props){
 const scene=useRef<HTMLDivElement>(null),books=useRef<(HTMLButtonElement|null)[]>([]);
 const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
 const [held,setHeld]=useState(false),[hovered,setHovered]=useState<string|null>(null),[focused,setFocused]=useState<string|null>(null);
 const [visible,setVisible]=useState(true),[hidden,setHidden]=useState(document.hidden);
 const reduced=useReducedMotion();
 const paused=held||!!hovered||!!focused||!!activeCourse||!visible||hidden||reduced;
 useEffect(()=>{
  if(activeCourse)return;
  // Native focus restored during cleanup can bypass React events. Read it after
  // the commit without depending on a rendering frame (which may be paused).
  let disposed=false;
  queueMicrotask(()=>{
   if(disposed)return;
   const element=document.activeElement as HTMLElement|null;
   setFocused(element&&scene.current?.parentElement?.contains(element)&&element.matches(':focus-visible')?element.dataset.courseId??null:null);
  });
  return()=>{disposed=true;};
 },[activeCourse]);
 useEffect(()=>{
  const node=scene.current!;
  const observer=new IntersectionObserver(entries=>setVisible(entries.some(entry=>entry.isIntersecting)));
  observer.observe(node);
  const visibility=()=>setHidden(document.hidden);
  document.addEventListener('visibilitychange',visibility);
  return()=>{observer.disconnect();document.removeEventListener('visibilitychange',visibility);};
 },[]);
 const start=(course:Course,index:number,fallback?:HTMLElement)=>{
  const origin=ready?books.current[index]:fallback;
  if(origin)onStart(course,origin,fallback??origin);
 };
 const focus=(course:Course,element:HTMLElement)=>{if(element.matches(':focus-visible'))setFocused(course.id);};
 return <section className="course-orbit" aria-label="古籍环绕学习路径" data-motion={paused?'paused':'running'}>
  <div className="course-orbit-toolbar"><span>三卷医理 · 一片星海</span><button type="button" disabled={reduced} onClick={()=>{setHeld(!held);setFocused(null);}} aria-label={held?'继续古籍公转':'暂停古籍公转'}>{held?<Play size={13}/>:<Pause size={13}/>}<span>{reduced?'静阅模式':held?'继续公转':'暂停公转'}</span></button></div>
  <div className="course-orbit-layout"><div className="course-orbit-scene" ref={scene}>
   {!failed&&<Suspense fallback={<div className="course-3d-status">正在展开三卷医理…</div>}><CourseScene paused={paused} reduced={reduced} highlight={hovered??focused} books={books} visual={visual} onReady={()=>setReady(true)} onError={()=>{setFailed(true);setReady(false);}}/></Suspense>}
   {failed&&<div className="course-3d-status">当前设备无法显示三维古籍，可从下方选择课程继续学习。</div>}
   <span className="course-nebula-label" aria-hidden="true">岐黄 · 知识星云</span>
   {courses.map((course,index)=>{
    return <button type="button" hidden={!ready} className={`orbit-book ${activeCourse===course.id?'is-reading':''}`} key={course.id} ref={element=>{books.current[index]=element;}}
     data-course-id={course.id} aria-label={`翻开 ${course.title}`} onClick={()=>start(course,index)}
     onPointerEnter={event=>{if(event.pointerType==='mouse')setHovered(course.id);}} onPointerLeave={()=>{setHovered(null);visual.current?.tilt(null,0,0);}}
     onPointerMove={event=>{if(event.pointerType==='mouse'){const rect=event.currentTarget.getBoundingClientRect();visual.current?.tilt(course.id,(event.clientX-rect.x)/rect.width-.5,(event.clientY-rect.y)/rect.height-.5);}}}
     onFocus={event=>focus(course,event.currentTarget)} onBlur={()=>setFocused(null)}>

     <div className="course-orbit-caption"><span className="course-volume-number">卷 {['一','二','三'][index]} · {course.level}</span><h3>{courseBookTitle(course)}</h3></div>
    </button>;
   })}
  </div>
  <CourseDeck completed={completed} paused={paused} activeCourse={activeCourse} onStart={(course,index,trigger)=>start(course,index,trigger)} onHighlight={setHovered} onFocus={setFocused}/></div>
  <p className="course-orbit-hint">轻触古籍，展开学习。悬停或键盘选中时，星海暂驻。</p>
 </section>;
}
