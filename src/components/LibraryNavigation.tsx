import {useEffect,useRef,useState} from 'react';
import {categories} from '../data/catalog';
import './library-navigation.css';
export default function LibraryNavigation({category,onChange}:{category:string;onChange:(category:string)=>void}){
 const sentinel=useRef<HTMLDivElement>(null),slot=useRef<HTMLDivElement>(null),bar=useRef<HTMLElement>(null),[docked,setDocked]=useState(false);
 useEffect(()=>{
  const root=slot.current?.closest('.cosmic-content-scroll');if(!root)return;
  let frame=0;
  const update=()=>{frame=0;if(!slot.current||!sentinel.current)return;const top=parseFloat(getComputedStyle(slot.current).top)||0;setDocked(sentinel.current.getBoundingClientRect().top<root.getBoundingClientRect().top+top);};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  root.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);update();
  return()=>{root.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);cancelAnimationFrame(frame);};
 },[]);
 useEffect(()=>{
  const nav=bar.current,selected=nav?.querySelector<HTMLElement>('[aria-pressed="true"]');if(!nav||!selected)return;
  const bounds=nav.getBoundingClientRect(),button=selected.getBoundingClientRect();
  if(button.left<bounds.left||button.right>bounds.right)nav.scrollTo({left:nav.scrollLeft+button.left-bounds.left-(bounds.width-button.width)/2,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 },[category]);
 return <><div ref={sentinel} className="library-nav-sentinel" aria-hidden="true"/><div ref={slot} className={`library-nav-slot${docked?' is-docked':''}`}><nav ref={bar} className="library-navigation" aria-label="知识库分类">{categories.map(item=><button type="button" key={item.type} aria-pressed={category===item.type} onClick={()=>onChange(item.type)}>{item.label}</button>)}</nav></div></>;
}
