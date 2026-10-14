import {useId} from 'react';
import {Bookmark} from 'lucide-react';
import type {Knowledge} from '../data/catalog';
import {AntiqueBook,knowledgeIllustrations} from './AntiqueBook';
import botanicalAtlas from '../assets/jade/botanical-specimens.webp';
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
const specimens:Record<string,[number,number]>={
 'herb-guizhi':[0,0],'herb-baishao':[50,0],'herb-chaihu':[100,0],
 'herb-gancao':[0,100],'herb-huangqi':[50,100],'herb-danggui':[100,100]
};

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
 const cell=specimens[id];
 return cell?<span className="botanical-sprite" style={{backgroundImage:`url(${botanicalAtlas})`,backgroundPosition:`${cell[0]}% ${cell[1]}%`}}/>:<BotanicalDrawing id={id}/>;
}

type MeridianProfile={path:string;focus:[number,number]};
const meridians:Record<string,MeridianProfile>={
 'meridian-stomach':{path:'M138 48Q151 64 146 89L157 118L152 174Q159 212 153 242L160 303',focus:[155,243]},
 'meridian-lung':{path:'M127 93Q151 82 169 99L186 139L207 188L219 222',focus:[195,160]},
 'meridian-largeintestine':{path:'M217 220L198 168L181 121Q177 92 150 80L143 53',focus:[181,121]},
 'meridian-spleen':{path:'M107 307L98 245L111 191L116 142Q112 111 133 104',focus:[105,216]},
 'meridian-heart':{path:'M139 101Q169 104 177 127L191 173L209 219',focus:[190,173]},
 'meridian-smallintestine':{path:'M207 219L188 168L173 120Q161 99 145 83L147 54',focus:[175,126]},
 'meridian-bladder':{path:'M141 44Q146 62 143 89L142 162L159 218L169 302',focus:[151,198]},
 'meridian-kidney':{path:'M115 303L104 241L113 181L119 129L128 102',focus:[111,219]},
 'meridian-pericardium':{path:'M130 100L162 108L179 142L198 186L213 222',focus:[182,149]},
 'meridian-sanjiao':{path:'M211 220L197 176L179 134L164 100L145 71',focus:[190,156]},
 'meridian-gallbladder':{path:'M148 48L155 79L172 104L160 149L168 193L173 246L175 305',focus:[167,200]},
 'meridian-liver':{path:'M113 307L107 246L119 186L122 144Q145 133 145 102',focus:[116,200]},
 'meridian-du':{path:'M131 306L131 235L132 177L131 123L132 79L131 32',focus:[132,151]},
 'meridian-ren':{path:'M129 183L129 153L130 121L129 93L129 69',focus:[130,122]}
};
function MeridianDrawing({id}:{id:string}){
 const glow=useId().replace(/:/g,''),profile=meridians[id]??meridians['meridian-ren'];
 return <svg className="meridian-drawing" viewBox="0 0 260 350" fill="none" aria-hidden="true">
  <defs><radialGradient id={glow}><stop stopColor="#f4df9a" stopOpacity=".55"/><stop offset="1" stopColor="#d6bd72" stopOpacity="0"/></radialGradient></defs>
  <g stroke="#9fc0a4" strokeWidth="1.15" opacity=".55">
   <ellipse cx="131" cy="37" rx="17" ry="23"/><path d="M119 57L118 71Q106 73 88 80Q78 91 72 116L61 156L44 198L43 220Q50 230 55 218L61 201L82 158L95 119L101 161L96 192L94 235L103 296L97 313L108 317L119 306L126 231L131 202L137 231L147 306L158 317L169 313L161 297L169 235L165 192L160 161L166 120L179 158L200 201L206 220Q212 230 219 221L216 198L199 156L188 116Q183 91 174 80Q155 73 144 71L143 57"/>
   <path d="M104 91Q120 83 131 91Q143 83 157 91M106 113Q116 107 126 119M136 119Q147 107 156 113M111 130Q131 142 153 130M111 149Q132 159 153 149M112 171Q131 179 151 171M115 189Q130 196 147 189M130 62L131 197M121 44Q131 50 141 44" opacity=".5"/>
  </g>
  <g stroke="#ccbd80" strokeWidth=".65" opacity=".22"><ellipse cx="132" cy="164" rx="108" ry="139"/><ellipse cx="132" cy="169" rx="119" ry="41" transform="rotate(-23 132 169)"/><path d="M23 278Q123 238 240 278"/></g>
  <path className="meridian-route-base" d={profile.path} stroke="#b6a26f" strokeWidth="1.1" opacity=".3"/>
  <path className="meridian-route" d={profile.path} stroke="#edcf80" strokeWidth="2.1" strokeLinecap="round"/>
  <circle className="meridian-pulse" cx={profile.focus[0]} cy={profile.focus[1]} r="25" fill={`url(#${glow})`}/>
  <circle className="meridian-focus" cx={profile.focus[0]} cy={profile.focus[1]} r="4.5" fill="#f5e5a4" stroke="#f5dfa3" strokeWidth="1.5"/>
  <circle cx="131" cy="97" r="2" fill="#dbc181"/><circle cx="143" cy="176" r="2" fill="#dbc181"/><circle cx="107" cy="246" r="2" fill="#dbc181"/>
 </svg>;
}

function TitleSlip({item,caption}:{item:Knowledge;caption:string}){
 return <span className="knowledge-title-slip"><span>{item.title}</span><small>{caption}</small></span>;
}
export function KnowledgeArtwork({item,saved=false}:{item:Knowledge;saved?:boolean}){
 const kind=getEntryKind(item);
 if(kind==='book')return <AntiqueBook item={item} saved={saved}/>;
 if(!kind)return null;
 const illustration=knowledgeIllustrations[item.id];
 const herb=item.relations.find(id=>id.startsWith('herb-'))??item.id;
 return <div className={`knowledge-artwork ${kind==='herb'?'specimen-sheet':kind==='formula'?'formula-folio':`${kind}-sheet`}`} data-kind={kind} aria-hidden="true">
  {kind==='herb'&&<><span className="knowledge-sheet-frame"/><TitleSlip item={item} caption="本草藏笺"/><div className="specimen-plant"><PlantSpecimen id={item.id}/></div><svg className="specimen-veins" viewBox="0 0 240 320" fill="none"><path d="M105 260Q151 180 173 88M133 204L199 184M153 157L118 121"/><path d="M101 260Q62 264 43 283M101 260Q117 275 155 283"/></svg><span className="knowledge-sheet-seal">本草</span><span className="knowledge-sheet-imprint">采形录色 · 循本而学</span></>}
  {kind==='formula'&&<><div className="formula-left"><span className="knowledge-sheet-frame"/><TitleSlip item={item} caption="岐黄方笺"/><span className="knowledge-sheet-seal">方</span></div><div className="formula-right"><span className="knowledge-sheet-frame"/><svg className="formula-links" viewBox="0 0 240 320" fill="none"><ellipse cx="146" cy="177" rx="72" ry="87" stroke="#c9b67e" strokeWidth="1"/>{[0,1,2,3,4].map(index=><circle key={index} cx={146+Math.sin(index*1.25)*72} cy={177+Math.cos(index*1.25)*87} r="3.5" fill="#d7bc78"/>)}<path d="M103 113Q174 156 184 210M108 233Q148 164 198 154" stroke="#c5b27b" strokeWidth=".7"/></svg><div className="formula-plant"><PlantSpecimen id={herb}/></div>{illustration&&<picture className="card-illustration formula-medallion"><img src={illustration} width={116} height={116} loading="lazy" decoding="async" alt=""/></picture>}</div><span className="formula-fold"/><span className="knowledge-sheet-imprint">展笺读方 · 连药识义</span></>}
  {kind==='meridian'&&<><span className="knowledge-sheet-frame"/><TitleSlip item={item} caption="循脉知境"/><MeridianDrawing id={item.id}/><span className="knowledge-sheet-seal">络</span><span className="knowledge-sheet-imprint">金线循行 · 知识相连</span></>}
  {(kind==='theory'||kind==='acupoint'||kind==='diagnosis'||kind==='physician')&&<KnowledgeSymbol kind={kind} item={item}/>}
  {saved&&<Bookmark className="knowledge-artwork-saved" size={16} fill="currentColor"/>}
 </div>;
}
