import {ArrowUpRight,Bookmark} from 'lucide-react';
import {categoryLabel,Knowledge} from '../data/catalog';
import yinYang from '../assets/jade/yin-yang.webp';
import guizhiTang from '../assets/jade/guizhi-tang.webp';
import caseLearning from '../assets/jade/case-learning.webp';
import bencao from '../assets/jade/classic-bencao.webp';
import huangdi from '../assets/jade/classic-huangdi.webp';
import jingui from '../assets/jade/classic-jingui.webp';
import nanjing from '../assets/jade/classic-nanjing.webp';
import qianjin from '../assets/jade/classic-qianjin.webp';
import shanghan from '../assets/jade/classic-shanghan.webp';
import shennong from '../assets/jade/classic-shennong.webp';
const illustrations:Record<string,string>={
 'theory-yinyang':yinYang,'formula-guizhi':guizhiTang,
 'case-learning':caseLearning,'classic-bencao':bencao,
 'classic-huangdi':huangdi,'classic-jingui':jingui,
 'classic-nanjing':nanjing,'classic-qianjin':qianjin,
 'classic-shanghan':shanghan,'classic-shennong':shennong
};
export default function KnowledgeCard({item,onOpen,saved}:{item:Knowledge;onOpen:(id:string)=>void;saved:boolean}){const illustration=illustrations[item.id];return <button className={`knowledge-card tone-${item.type}${illustration?' with-illustration':''}`} onClick={()=>onOpen(item.id)} aria-label={`阅读 ${item.title}`}>
 <div className="card-art">{illustration&&<picture className="card-illustration"><source media="(min-width:701px)" srcSet={illustration}/><img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" alt="" width={116} height={116} decoding="async"/></picture>}<span className="art-orbit"/><span className="art-symbol">{item.type==='药'?'艹':item.type==='经'?'册':item.type==='方'?'方':item.type==='理'?'☯':item.type==='穴'?'◉':'络'}</span><span className="art-title">{item.title}</span><span className="art-category">{categoryLabel(item.type)}</span>{saved&&<Bookmark size={16} className="saved-mark" fill="currentColor"/>}</div>
 <div className="card-copy"><div className="eyebrow">{categoryLabel(item.type)}<span>· 知识导读</span></div><h3>{item.title}<ArrowUpRight size={17}/></h3><p>{item.subtitle}</p><div className="card-tags">{item.tags.slice(0,2).map(tag=><span key={tag}>{tag}</span>)}</div></div>
 </button>}
