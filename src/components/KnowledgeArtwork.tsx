import {Bookmark} from 'lucide-react';
import type {Knowledge} from '../data/catalog';
import {AntiqueBook} from './AntiqueBook';
import {KnowledgeImage} from './KnowledgeImage';
import {MeridianDrawing} from './MeridianDrawing';
import {knowledgeImages} from '../data/knowledge-images';
import './knowledge-artwork.css';
import {KnowledgeSymbol,type SymbolKind} from './KnowledgeSymbols';

export type EntryKind='book'|'herb'|'formula'|'meridian'|SymbolKind;
export function getEntryKind(item:Knowledge):EntryKind|null{
 if(item.type==='经'||item.type==='案')return 'book';
 if(item.type==='药')return 'herb';
 if(item.type==='方')return 'formula';
 if(item.type==='经络')return 'meridian';
 if(item.type==='理')return 'theory';
 if(item.type==='穴')return 'acupoint';
 if(item.type==='法')return 'diagnosis';
 if(item.type==='人')return 'physician';
 return null;
}
// Decorative drawings for the remaining materials, without embedded knowledge text.
function BotanicalDrawing({id}:{id:string}){
 const fruit=/dazao|gouqizi|wuweizi|chenpi/.test(id),flower=/juhua|bohe/.test(id),fungus=id==='herb-fuling';
 const seed=[...id].reduce((sum,char)=>sum+char.charCodeAt(0),0)%7;
 return <svg className="botanical-drawing" viewBox="0 0 240 280" fill="none" aria-hidden="true">
  {fungus?<g stroke="#ceb78b" strokeWidth="1.3"><path d="M55 145Q52 117 89 113L166 119Q194 140 184 184L150 213L78 207Q49 185 55 145Z" fill="#b7b89b"/><path d="M59 153Q121 180 183 158M70 190L150 197L179 174M89 119Q97 159 78 198" opacity=".5"/></g>:<>
   <path d={`M117 219Q${94+seed*2} 146 138 45M118 171Q76 136 55 83M122 137Q164 113 186 75`} stroke="#d1bc87" strokeWidth="2"/>
   {[0,1,2,3,4,5,6].map(index=>{const right=index%2===0,y=68+index*20,x=right?132:118;return <g key={index} transform={`translate(${x} ${y}) rotate(${right?-35:145})`}>
    <path d="M0 0C10 -26 32 -30 46 -24C37 -3 17 7 0 0Z" fill={index%3?'#6d925a':'#a0ae6a'} stroke="#c9bd83" strokeWidth=".8"/>
    <path d="M1 0L39 -20M12 -6L16 -20M23 -12L26 1" stroke="#e0cf94" strokeWidth=".7" opacity=".7"/>
   </g>;})}
   {fruit?<g fill="#bd774d" stroke="#d9b67e">{[0,1,2,3,4,5,6].map(index=><ellipse key={index} cx={76+index%3*37} cy={177+Math.floor(index/3)*23} rx={id==='herb-dazao'?13:8} ry={id==='herb-dazao'?19:12} transform={`rotate(${index*11} ${76+index%3*37} ${177+Math.floor(index/3)*23})`}/>)}</g>:<g stroke="#c7a66d" strokeWidth="2" fill="none">{[0,1,2,3,4,5,6,7].map(index=><path key={index} d={`M${112+index*3} 205Q${87+index*9} 233 ${75+index*13} ${257-index%3*9}Q${84+index*12} 234 ${111+index*4} 209`} fill={index%2?'#a89562':'#c2ae7a'}/>)}</g>}
   {flower&&<g transform="translate(143 63)">{Array.from({length:12},(_,index)=><ellipse key={index} cx="0" cy="-15" rx="5" ry="17" fill="#decf87" stroke="#e5dba9" strokeWidth=".5" transform={`rotate(${index*30})`}/>)}<circle r="10" fill="#aa8746"/><circle r="4" fill="#ead394"/></g>}
  </>}
 </svg>;
}
function PlantSpecimen({id}:{id:string}){
 return knowledgeImages[id]?<KnowledgeImage id={id} className="botanical-sprite"/>:<BotanicalDrawing id={id}/>;
}

function TitleSlip({item,caption}:{item:Knowledge;caption:string}){
 return <span className="knowledge-title-slip"><span>{item.title}</span><small>{caption}</small></span>;
}
export function KnowledgeArtwork({item,saved=false}:{item:Knowledge;saved?:boolean}){
 const kind=getEntryKind(item);
 if(kind==='book')return <AntiqueBook item={item} saved={saved}/>;
 if(!kind)return null;


 return <div className={`knowledge-artwork ${kind==='herb'?'specimen-sheet':kind==='formula'?'formula-folio':`${kind}-sheet`}`} data-kind={kind} aria-hidden="true">
  {kind==='herb'&&<><span className="knowledge-sheet-frame"/><TitleSlip item={item} caption="本草藏笺"/><div className="specimen-plant"><PlantSpecimen id={item.id}/></div><svg className="specimen-veins" viewBox="0 0 240 320" fill="none"><path d="M105 260Q151 180 173 88M133 204L199 184M153 157L118 121"/><path d="M101 260Q62 264 43 283M101 260Q117 275 155 283"/></svg><span className="knowledge-sheet-seal">本草</span><span className="knowledge-sheet-imprint">采形录色 · 循本而学</span></>}
  {kind==='formula'&&<><div className="formula-left"><span className="knowledge-sheet-frame"/><TitleSlip item={item} caption="岐黄方笺"/><span className="knowledge-sheet-seal">方</span></div><div className="formula-right"><span className="knowledge-sheet-frame"/><svg className="formula-links" viewBox="0 0 240 320" fill="none"><ellipse cx="146" cy="177" rx="72" ry="87" stroke="#c9b67e" strokeWidth="1"/>{[0,1,2,3,4].map(index=><circle key={index} cx={146+Math.sin(index*1.25)*72} cy={177+Math.cos(index*1.25)*87} r="3.5" fill="#d7bc78"/>)}<path d="M103 113Q174 156 184 210M108 233Q148 164 198 154" stroke="#c5b27b" strokeWidth=".7"/></svg><div className="formula-plant"><KnowledgeImage id={item.id}/></div></div><span className="formula-fold"/><span className="knowledge-sheet-imprint">展笺读方 · 连药识义</span></>}
  {kind==='meridian'&&<><span className="knowledge-sheet-frame"/><TitleSlip item={item} caption="循脉知境"/><MeridianDrawing id={item.id}/><span className="knowledge-sheet-seal">络</span><span className="knowledge-sheet-imprint">金线循行 · 知识相连</span></>}
  {(kind==='theory'||kind==='acupoint'||kind==='diagnosis'||kind==='physician')&&<KnowledgeSymbol kind={kind} item={item}/>}
  {saved&&<Bookmark className="knowledge-artwork-saved" size={16} fill="currentColor"/>}
 </div>;
}
