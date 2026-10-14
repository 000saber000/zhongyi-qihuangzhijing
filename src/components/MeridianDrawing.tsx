import {useId} from 'react';
import {KnowledgeImage} from './KnowledgeImage';
import {meridianArt,meridianStroke} from '../data/meridian-art';
import goldLeaf from '../assets/jade/meridian-gold-leaf.webp';
import './meridian-drawing.css';

export function MeridianDrawing({id}:{id:string}){
 const key=useId().replace(/:/g,''),profile=meridianArt[id]??meridianArt['meridian-ren'];
 const {center,ribbon,samples}=meridianStroke(profile.points);
 const [x,y]=samples.reduce((nearest,point)=>Math.hypot(point[0]-profile.focus[0],point[1]-profile.focus[1])<Math.hypot(nearest[0]-profile.focus[0],nearest[1]-profile.focus[1])?point:nearest);
 return <svg className="meridian-drawing" data-view={profile.view} viewBox="0 0 260 260" fill="none" aria-hidden="true">
  <defs>
   <pattern id={`${key}-foil`} patternUnits="userSpaceOnUse" width="96" height="96"><image className="meridian-gold-texture" href={goldLeaf} width="96" height="96" preserveAspectRatio="xMidYMid slice"/></pattern>
   <linearGradient id={`${key}-metal`} x1="65" y1="20" x2="188" y2="238" gradientUnits="userSpaceOnUse"><stop stopColor="#8b693c"/><stop offset=".18" stopColor="#e8d49c"/><stop offset=".37" stopColor="#fff0c0"/><stop offset=".56" stopColor="#b19457"/><stop offset=".78" stopColor="#f2dfa8"/><stop offset="1" stopColor="#a07c43"/></linearGradient>
   <linearGradient id={`${key}-edge`} x1="140" y1="20" x2="125" y2="240" gradientUnits="userSpaceOnUse"><stop stopColor="#fff2c9" stopOpacity=".3"/><stop offset=".35" stopColor="#fff4d0"/><stop offset=".65" stopColor="#e8d29a" stopOpacity=".35"/><stop offset="1" stopColor="#fff0ba" stopOpacity=".6"/></linearGradient>
   <radialGradient id={`${key}-glow`}><stop stopColor="#f4dfa9" stopOpacity=".5"/><stop offset="1" stopColor="#d6ba76" stopOpacity="0"/></radialGradient>
   <filter id={`${key}-relief`} x="-15%" y="-15%" width="130%" height="130%"><feDropShadow dx=".35" dy=".55" stdDeviation=".4" floodColor="#153a32" floodOpacity=".65"/></filter>
   <mask id={`${key}-reveal`} maskUnits="userSpaceOnUse" x="0" y="0" width="260" height="260" style={{maskType:'alpha'}}><path className="meridian-route" d={center} stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></mask>
  </defs>
  <KnowledgeImage id={id} className="meridian-illustration"/>
  <g className="meridian-orbits" stroke="#c7b680" strokeWidth=".55" opacity=".12"><ellipse cx="130" cy="131" rx="108" ry="122"/><ellipse cx="131" cy="133" rx="108" ry="33" transform="rotate(-24 131 133)"/></g>
  <g className="meridian-material" mask={`url(#${key}-reveal)`}>
   <path d={ribbon} fill={`url(#${key}-foil)`} filter={`url(#${key}-relief)`}/>
   <path d={ribbon} fill={`url(#${key}-metal)`} opacity=".55"/>
   <path d={center} stroke={`url(#${key}-edge)`} strokeWidth=".6" strokeLinecap="round" opacity=".7"/>
   <path className="meridian-sweep" d={center} stroke="#fff3cc" strokeWidth="1.8" strokeLinecap="round" opacity="0"/>
  </g>
  <circle className="meridian-pulse" cx={x} cy={y} r="12" fill={`url(#${key}-glow)`} opacity=".35"/>
  <circle className="meridian-focus" cx={x} cy={y} r="1.5" fill="#fff1c6" stroke="#d8bc78" strokeWidth=".45"/>
 </svg>;
}
