import {knowledge,categories} from '../data/catalog';
import {GALAXY} from './galaxyParams';
export const fieldColors:Record<string,string>={'理':'#c5dbb5','经':'#e1c18d','药':'#84c6a3','方':'#dba18d','经络':'#89c8d0','穴':'#afa9dc','人':'#d6bb7e','法':'#b4cfba','案':'#c5aca2'};
export const landmarks=new Set(['classic-huangdi','classic-shanghan','classic-shennong','theory-yinyang','theory-five-elements','theory-zangxiang','concept-qi-blood','formula-guizhi','formula-xiaochaihu','herb-guizhi','herb-baishao','herb-chaihu','point-zusanli','meridian-stomach','person-zhangzhongjing','method-bazheng']);
function hash(s:string){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
export const spaceNodes=knowledge.map((item,index)=>{const h=hash(item.id),cat=categories.findIndex(c=>c.type===item.type)-1;const r=780+(h%2460);const angle=(cat/9)*Math.PI*2+(r/GALAXY.RADIUS)*GALAXY.TWIST+((h>>>12)%100)/180;const y=((h>>>20)%400)-200;return {item,index,position:[Math.cos(angle)*r,y,Math.sin(angle)*r] as [number,number,number],color:fieldColors[item.type]||'#bbcab2'}});
export const nodeById=new Map(spaceNodes.map(n=>[n.item.id,n]));
export const relationEdges=(()=>{const seen=new Set<string>();return knowledge.flatMap(k=>k.relations.flatMap(id=>{const key=[k.id,id].sort().join('|');if(!nodeById.has(id)||seen.has(key))return [];seen.add(key);return [{from:k.id,to:id}]}))})();
