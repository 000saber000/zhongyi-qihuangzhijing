import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {categories} from '../data/catalog';
import './library-navigation.css';
export default function LibraryNavigation({category,onChange,onHeaderDockedChange}:{category:string;onChange:(category:string)=>void;onHeaderDockedChange:(docked:boolean)=>void}){
 const sentinel=useRef<HTMLDivElement>(null),slot=useRef<HTMLDivElement>(null),bar=useRef<HTMLElement>(null),[docked,setDocked]=useState(false);
 const [desktop,setDesktop]=useState(()=>window.matchMedia('(min-width:701px)').matches),[header,setHeader]=useState<HTMLElement|null>(null),focusToRestore=useRef<string|null>(null),focusedCategory=useRef<string|null>(null),dockedRef=useRef(docked);dockedRef.current=docked;
 const inHeader=desktop&&docked&&Boolean(header);
 const inHeaderRef=useRef(inHeader);inHeaderRef.current=inHeader;
 const rememberFocus=()=>{const active=document.activeElement;focusToRestore.current=bar.current?.contains(active)?(active as HTMLElement).dataset.category??null:active===document.body?focusedCategory.current:null;};
 useEffect(()=>{
  const viewport=window.matchMedia('(min-width:701px)'),change=()=>{if(dockedRef.current||inHeaderRef.current)rememberFocus();setDesktop(viewport.matches);};
  setHeader(slot.current?.closest('.universe')?.querySelector<HTMLElement>('.library-header-anchor')??null);
  viewport.addEventListener('change',change);return()=>viewport.removeEventListener('change',change);
 },[]);
 useEffect(()=>{onHeaderDockedChange(inHeader);return()=>onHeaderDockedChange(false);},[inHeader,onHeaderDockedChange]);
 useEffect(()=>{
  const root=slot.current?.closest('.cosmic-content-scroll');if(!root)return;
  let frame=0;
  const update=()=>{frame=0;if(!slot.current||!sentinel.current)return;const top=parseFloat(getComputedStyle(slot.current).top)||0,next=sentinel.current.getBoundingClientRect().top<root.getBoundingClientRect().top+top;if(next!==dockedRef.current&&(window.matchMedia('(min-width:701px)').matches||inHeaderRef.current))rememberFocus();setDocked(next);};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  root.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);update();
  return()=>{root.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);cancelAnimationFrame(frame);};
 },[]);
 useEffect(()=>{
  const nav=bar.current,selected=nav?.querySelector<HTMLElement>('[aria-pressed="true"]');if(!nav||!selected)return;
  const bounds=nav.getBoundingClientRect(),button=selected.getBoundingClientRect();
  if(button.left<bounds.left||button.right>bounds.right)nav.scrollTo({left:nav.scrollLeft+button.left-bounds.left-(bounds.width-button.width)/2,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 },[category,inHeader]);
 useEffect(()=>{
  if(!focusToRestore.current)return;const button=[...bar.current?.querySelectorAll<HTMLButtonElement>('button')??[]].find(item=>item.dataset.category===focusToRestore.current);button?.focus({preventScroll:true});
  if(button&&bar.current){const bounds=bar.current.getBoundingClientRect(),focus=button.getBoundingClientRect();if(focus.left<bounds.left||focus.right>bounds.right)bar.current.scrollLeft+=focus.left-bounds.left;}
  focusToRestore.current=null;
 },[inHeader]);
 const navigation=<nav ref={bar} className="library-navigation" aria-label="知识库分类" onFocus={event=>{focusedCategory.current=(event.target as HTMLElement).dataset.category??null;}} onBlur={event=>{
  if(event.relatedTarget instanceof Node&&event.currentTarget.contains(event.relatedTarget))return;
  // CSS can hide the header before matchMedia's change event reaches React.
  // Preserve focus for that move, but discard it after an intentional departure.
  if(desktop===window.matchMedia('(min-width:701px)').matches&&!focusToRestore.current)focusedCategory.current=null;
 }}>{categories.map(item=><button type="button" key={item.type} data-category={item.type} aria-pressed={category===item.type} onClick={()=>onChange(item.type)}>{item.label}</button>)}</nav>;
 return <><div ref={sentinel} className="library-nav-sentinel" aria-hidden="true"/><div ref={slot} className={`library-nav-slot${docked?' is-docked':''}${inHeader?' is-in-header':''}`}>{!inHeader&&navigation}</div>{inHeader&&header&&createPortal(<div className="library-header-nav is-docked">{navigation}</div>,header)}</>;
}
