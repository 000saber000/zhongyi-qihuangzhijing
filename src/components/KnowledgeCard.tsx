import {ArrowUpRight,Bookmark} from 'lucide-react';
import {categoryLabel,Knowledge} from '../data/catalog';
export default function KnowledgeCard({item,onOpen,saved}:{item:Knowledge;onOpen:(id:string)=>void;saved:boolean}){return <button className={`knowledge-card tone-${item.type}`} onClick={()=>onOpen(item.id)} aria-label={`阅读 ${item.title}`}>
 <div className="card-art"><span className="art-orbit"/><span className="art-symbol">{item.type==='药'?'艹':item.type==='经'?'册':item.type==='方'?'方':item.type==='理'?'☯':item.type==='穴'?'◉':'络'}</span><span className="art-title">{item.title}</span><span className="art-category">{categoryLabel(item.type)}</span>{saved&&<Bookmark size={16} className="saved-mark" fill="currentColor"/>}</div>
 <div className="card-copy"><div className="eyebrow">{categoryLabel(item.type)}<span>· 知识导读</span></div><h3>{item.title}<ArrowUpRight size={17}/></h3><p>{item.subtitle}</p><div className="card-tags">{item.tags.slice(0,2).map(tag=><span key={tag}>{tag}</span>)}</div></div>
 </button>}
