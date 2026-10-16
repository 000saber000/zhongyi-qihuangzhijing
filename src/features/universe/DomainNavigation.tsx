import type {CSSProperties} from 'react';
import {categories} from '../../data/catalog';
import PillNav from '../../components/react-bits/PillNav';
import './domain-navigation.css';

const items=categories.map(item=>({label:item.type==='全部'?'全部':item.glyph,ariaLabel:`筛选 ${item.label}`,title:item.label}));
const dimensions={'--pn-h':'30px','--pn-inner':'30px','--pn-pad':'0px','--pn-x':'0px','--pn-font':'12px'} as CSSProperties;
export default function DomainNavigation({category,onChange}:{category:string;onChange:(category:string)=>void}){
 return <aside className="cosmic-domains" aria-label="知识领域"><span>知识领域</span><PillNav
  items={items} activeIndex={categories.findIndex(item=>item.type===category)} onItemClick={(_,index)=>onChange(categories[index].type)}
  ariaLabel="领域分类" theme="dark" surface="none" itemStyle="plain" hoverEffect="fill" indicator="pill" collapse="never" intro={false}
  highlightColor="#a6b48a" highlightTextColor="#142d28" textColor="#bdd0ad" className="domain-pill-nav" style={dimensions}
 /></aside>;
}
