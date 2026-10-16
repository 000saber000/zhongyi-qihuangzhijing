import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {categories} from '../data/catalog';
import GooeyNav from './react-bits/GooeyNav';
import './library-navigation.css';
const items=categories.map(item=>({label:item.label,value:item.type}));
export default function LibraryNavigation({category,onChange,onHeaderDockedChange}:{category:string;onChange:(category:string)=>void;onHeaderDockedChange:(docked:boolean)=>void}){
 const sentinel=useRef<HTMLDivElement>(null),slot=useRef<HTMLDivElement>(null),bar=useRef<HTMLElement>(null),[docked,setDocked]=useState(false);
 const [header,setHeader]=useState<HTMLElement|null>(null),focusToRestore=useRef<string|null>(null),focusedCategory=useRef<string|null>(null),dockedRef=useRef(docked);dockedRef.current=docked;
 const inHeader=docked&&Boolean(header);
 const rememberFocus=()=>{const active=document.activeElement;focusToRestore.current=bar.current?.contains(active)?(active as HTMLElement).dataset.category??null:active===document.body?focusedCategory.current:null;};
 useEffect(()=>{
  setHeader(slot.current?.closest('.universe')?.querySelector<HTMLElement>('.library-header-anchor')??null);
 },[]);
 useEffect(()=>{onHeaderDockedChange(inHeader);return()=>onHeaderDockedChange(false);},[inHeader,onHeaderDockedChange]);
 useEffect(()=>{
  const root=slot.current?.closest('.cosmic-content-scroll');if(!root)return;
  let frame=0;
  const update=()=>{frame=0;if(!slot.current||!sentinel.current)return;const top=parseFloat(getComputedStyle(slot.current).top)||0,next=sentinel.current.getBoundingClientRect().top<root.getBoundingClientRect().top+top;if(next!==dockedRef.current)rememberFocus();setDocked(next);};
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
  if(!focusToRestore.current)focusedCategory.current=null;
 }}><GooeyNav items={items} activeIndex={Math.max(0,categories.findIndex(item=>item.type===category))} onChange={index=>onChange(categories[index].type)} theme="dark" frame={false} color="#a6b48a" activeTextColor="#142d28" colors={['#a6b48a','#d1c393','#7f9e88']} animationTime={600} particleCount={15} spread={24} timeVariance={200} gooeyness={.5} wobble={.5} className="library-gooey-nav"/></nav>;
 return <><div ref={sentinel} className="library-nav-sentinel" aria-hidden="true"/><div ref={slot} className={`library-nav-slot${docked?' is-docked':''}${inHeader?' is-in-header':''}`}>{!inHeader&&navigation}</div>{inHeader&&header&&createPortal(<div className="library-header-nav is-docked">{navigation}</div>,header)}</>;
}
