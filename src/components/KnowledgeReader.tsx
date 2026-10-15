import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ChevronLeft,ChevronRight,List} from 'lucide-react';
import type {Knowledge} from '../data/catalog';
import {chaptersFrom} from '../data/chapters';
import './chapters.css';

export default function KnowledgeReader({item,children}:{item:Knowledge;children:ReactNode}){
 const chapters=chaptersFrom(item),[selected,setSelected]=useState(-1),[open,setOpen]=useState(false);
 const active=selected<chapters.length?selected:-1,chapter=chapters[active];
 const heading=useRef<HTMLHeadingElement>(null),reader=useRef<HTMLElement>(null),navigated=useRef(false);
 useEffect(()=>{if(navigated.current){heading.current?.focus({preventScroll:true});reader.current?.scrollIntoView({block:'start'});}},[active]);
 const choose=(index:number)=>{navigated.current=true;setSelected(index);setOpen(false);};
 return <section className="chapter-reader" aria-label="章节阅读" ref={reader}>
  <aside className="chapter-directory"><button type="button" className="chapter-directory-toggle" aria-expanded={open} aria-controls="chapter-reader-directory" onClick={()=>setOpen(!open)}><List size={17}/>章节目录<span>{chapters.length} 章</span></button><div className="chapter-directory-title">章节目录 <small>{chapters.length} 章</small></div><nav id="chapter-reader-directory" data-open={open} aria-label="章节目录"><button type="button" aria-current={active===-1?'page':undefined} onClick={()=>choose(-1)}>全书导读</button>{chapters.map((item,index)=><button type="button" key={index} aria-current={active===index?'page':undefined} onClick={()=>choose(index)}><small>第 {index+1} 章</small><span>{item.title}</span></button>)}{!chapters.length&&<p>章节正文尚未录入。</p>}</nav></aside>
  <div className="reading-panel chapter-reading-content"><h2 ref={heading} tabIndex={-1}>{chapter?chapter.title:'全书导读'}</h2>{chapter?<section aria-label="知识正文"><p className="chapter-position">第 {active+1} 章 / 共 {chapters.length} 章</p>{chapter.body?<p className="classic-body">{chapter.body}</p>:<p className="chapter-empty">本章正文尚未录入。</p>}</section>:children}
   {chapters.length>0&&<div className="chapter-pagination"><button type="button" className="outline" disabled={active===-1} onClick={()=>choose(active-1)}><ChevronLeft size={15}/>{active===0?'全书导读':'上一章'}</button><span>{active===-1?`共 ${chapters.length} 章`:`${active+1} / ${chapters.length}`}</span><button type="button" className="outline" disabled={active===chapters.length-1} onClick={()=>choose(active+1)}>{active===-1?'开始阅读':'下一章'}<ChevronRight size={15}/></button></div>}
  </div>
 </section>;
}
