import {useState} from 'react';
import {ArrowUpRight,Network} from 'lucide-react';
import {knowledge,categoryLabel,categories} from '../data/catalog';
const ids=['classic-huangdi','theory-yinyang','theory-five-elements','theory-zangxiang','concept-qi-blood','theory-jingluo','meridian-stomach','point-zusanli','classic-shanghan','formula-guizhi','herb-guizhi','herb-baishao','formula-xiaochaihu','herb-chaihu','person-zhangzhongjing','method-bazheng'];
const nodes=ids.map(id=>knowledge.find(k=>k.id===id)).filter((k):k is typeof knowledge[number]=>!!k);
const colors:Record<string,string>={'经':'#897545','理':'#3e7059','药':'#789165','方':'#ad7665','经络':'#688b8d','穴':'#807895','人':'#9a8355','法':'#65887b'};
export default function Graph({open}:{open:(id:string)=>void}){
 const [selected,setSelected]=useState('classic-huangdi');const [filter,setFilter]=useState('全部');
 const item=knowledge.find(k=>k.id===selected)!;
 const positions=nodes.map((k,i)=>({id:k.id,x:420+Math.cos(i*Math.PI*2/nodes.length)*((i%3===0)?210:300),y:285+Math.sin(i*Math.PI*2/nodes.length)*((i%3===0)?170:220)}));
 const pos=(id:string)=>positions.find(p=>p.id===id);
 const connected=(id:string)=>id===selected||item.relations.includes(id)||knowledge.find(k=>k.id===id)?.relations.includes(selected);
 return <div className="graph-layout"><div className="graph-board"><div className="graph-toolbar"><span><Network size={17}/> 关联探索</span><select aria-label="图谱分类" value={filter} onChange={e=>setFilter(e.target.value)}>{categories.filter(c=>nodes.some(n=>n.type===c.type)||c.type==='全部').map(c=><option key={c.type} value={c.type}>{c.label}</option>)}</select></div>
 <svg viewBox="0 0 840 570" className="network-canvas" aria-label="中医知识关系图"><defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#deded2"/></pattern></defs><rect width="840" height="570" fill="url(#dots)"/><circle cx="420" cy="285" r="240" fill="none" stroke="#e7e5da"/>
 {nodes.flatMap(n=>n.relations.map(id=>{const a=pos(n.id),b=pos(id);if(!a||!b||(n.id>id&&nodes.find(k=>k.id===id)?.relations.includes(n.id)))return null; const lit=n.id===selected||id===selected; return <path key={`${n.id}-${id}`} d={`M${a.x},${a.y} Q420,285 ${b.x},${b.y}`} fill="none" stroke={lit?'#789480':'#d7ddcf'} strokeWidth={lit?2:1} opacity={lit?1:.65}/>;}))}
 {nodes.map((n,i)=>{const p=positions[i],visible=filter==='全部'||filter===n.type;return <g key={n.id} opacity={visible?1:.16}><circle cx={p.x} cy={p.y} r={selected===n.id?39:31} fill={selected===n.id?'#e8eee0':'#f9faf3'} stroke={colors[n.type]} strokeWidth={selected===n.id?2:1} opacity={connected(n.id)?1:.7}/><foreignObject x={p.x-57} y={p.y-24} width="114" height="48"><button className="graph-node" aria-label={`图谱节点 ${n.title}`} onClick={()=>{setSelected(n.id);setFilter('全部')}} style={{color:colors[n.type]}}>{n.title}</button></foreignObject><text x={p.x} y={p.y+52} textAnchor="middle" fill="#999a89" fontSize="10">{categoryLabel(n.type)}</text></g>})}</svg>
 <div className="graph-foot"><span>点击节点，发现知识之间的联系</span><span>精选 {nodes.length} 个节点 · Demo</span></div></div>
 <aside className="graph-detail"><span className="section-kicker">SELECTED KNOWLEDGE</span><span className="pill">{categoryLabel(item.type)}</span><h2>{item.title}</h2><p>{item.summary}</p><button className="primary" onClick={()=>open(item.id)}>查看知识详情 <ArrowUpRight size={16}/></button><hr/><h4>与它相关</h4>{item.relations.map(id=>{const k=knowledge.find(n=>n.id===id);return k&&<button className="relation-row" key={id} onClick={()=>{if(nodes.some(n=>n.id===id))setSelected(id);else open(id)}}><span>{k.title}<small>{categoryLabel(k.type)}</small></span><ArrowUpRight size={15}/></button>})}</aside></div>
}
