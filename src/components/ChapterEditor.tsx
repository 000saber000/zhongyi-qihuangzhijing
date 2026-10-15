import {useState} from 'react';
import {ArrowDown,ArrowUp,Plus,Trash2} from 'lucide-react';
import type {Chapter} from '../data/catalog';
import {BOOK_BODY_LIMIT,CHAPTER_BODY_LIMIT,CHAPTER_LIMIT} from '../data/chapters';
import './chapters.css';

export default function ChapterEditor({value,onChange}:{value:Chapter[];onChange:(chapters:Chapter[])=>void}){
 const [selected,setSelected]=useState(0);
 const active=Math.min(selected,value.length-1),chapter=value[active];
 const total=value.reduce((sum,item)=>sum+item.body.length,0);
 const update=(key:keyof Chapter,text:string)=>onChange(value.map((item,i)=>i===active?{...item,[key]:text}:item));
 const add=()=>{onChange([...value,{title:'',body:''}]);setSelected(value.length);};
 const move=(index:number,offset:number)=>{const next=[...value],target=index+offset;[next[index],next[target]]=[next[target],next[index]];onChange(next);setSelected(target);};
 const remove=(index:number)=>{if((value[index].title||value[index].body)&&!window.confirm('删除此章节及其正文？保存草稿后生效。'))return;onChange(value.filter((_,i)=>i!==index));setSelected(index<active?active-1:active);};
 return <section className="chapter-editor" aria-label="章节编辑器">
  <div className="chapter-editor-heading"><div><h3>章节正文</h3><p>按目录组织内容，每章单独填写标题和正文。</p></div><button className="outline" type="button" disabled={value.length>=CHAPTER_LIMIT} onClick={add}><Plus size={15}/>添加章节</button></div>
  <div className="chapter-editor-layout"><div className="chapter-edit-list" role="group" aria-label="编辑章节目录">{value.map((item,index)=><div className={active===index?'selected':''} key={index}><button type="button" className="chapter-edit-select" aria-pressed={active===index} onClick={()=>setSelected(index)}><small>第 {index+1} 章</small><span>{item.title||'未命名章节'}</span></button><div className="chapter-edit-actions"><button type="button" disabled={index===0} aria-label={`上移第${index+1}章`} title="上移章节" onClick={()=>move(index,-1)}><ArrowUp size={14}/></button><button type="button" disabled={index===value.length-1} aria-label={`下移第${index+1}章`} title="下移章节" onClick={()=>move(index,1)}><ArrowDown size={14}/></button><button type="button" aria-label={`删除第${index+1}章`} title="删除章节" onClick={()=>remove(index)}><Trash2 size={14}/></button></div></div>)}{!value.length&&<p className="chapter-empty">还没有章节，点击“添加章节”开始录入。</p>}</div>
   {chapter&&<div className="chapter-edit-content"><label>章节标题<input aria-label="章节标题" required maxLength={120} value={chapter.title} onChange={event=>update('title',event.target.value)} placeholder="例如 上古天真论篇第一"/></label><label>章节正文<textarea aria-label="章节正文" rows={14} maxLength={CHAPTER_BODY_LIMIT} value={chapter.body} onChange={event=>update('body',event.target.value)} placeholder="在这里录入本章原文或整理后的正文，保留段落换行。"/><small>{chapter.body.length.toLocaleString()} / {CHAPTER_BODY_LIMIT.toLocaleString()} 字符</small></label></div>}
  </div><p className="chapter-editor-count">共 {value.length} 章 · 正文合计 {total.toLocaleString()} / {BOOK_BODY_LIMIT.toLocaleString()} 字符</p>{total>BOOK_BODY_LIMIT&&<p role="alert">全书正文超过字符上限，请精简后保存。</p>}
 </section>;
}
