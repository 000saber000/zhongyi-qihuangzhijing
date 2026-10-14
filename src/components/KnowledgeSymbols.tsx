import {useId} from 'react';
import type {Knowledge} from '../data/catalog';
import yinYang from '../assets/jade/yin-yang.webp';
import physicians from '../assets/jade/physician-portraits.webp';
import './knowledge-symbols.css';

export type SymbolKind='theory'|'acupoint'|'diagnosis'|'physician';
const elements=['木','火','土','金','水'];
function JadeDisc({id}:{id:string}){
 const gradient=useId().replace(/:/g,'');
 return <div className="jade-disc">
  <svg viewBox="0 0 260 260" fill="none">
   <defs><linearGradient id={gradient} x1="55" y1="48" x2="201" y2="211" gradientUnits="userSpaceOnUse"><stop stopColor="#f0dfac"/><stop offset=".48" stopColor="#b7ba88"/><stop offset="1" stopColor="#687f61"/></linearGradient></defs>
   <g className="jade-orbit" stroke="#cbb77c" strokeWidth=".8">
    <circle cx="130" cy="130" r="114" opacity=".32"/><circle cx="130" cy="130" r="103" strokeDasharray="2 8" opacity=".5"/>
    {Array.from({length:40},(_,index)=><path key={index} d="M130 16V23" transform={`rotate(${index*9} 130 130)`} opacity={index%5===0?.75:.3}/>)}
    {elements.map((label,index)=>{const angle=(index*72-90)*Math.PI/180,x=130+Math.cos(angle)*100,y=130+Math.sin(angle)*100;return <g key={label}><circle cx={x} cy={y} r="13" fill="#1a3730"/><text x={x} y={y+4} textAnchor="middle" fill="#d9c594" stroke="none" fontSize="12">{label}</text></g>;})}
    {id==='theory-five-elements'&&<path d="M130 30L189 211L35 99L225 99L71 211Z" opacity=".35"/>}
   </g>
   <g className="jade-halves">
    <g className="jade-yin"><path d="M130 51A79 79 0 0 0 130 209A39.5 39.5 0 0 0 130 130A39.5 39.5 0 0 1 130 51Z" fill="#173c32" stroke="#d5c491" strokeWidth="1.2"/><circle cx="130" cy="169.5" r="9" fill={`url(#${gradient})`}/><path d="M88 76Q53 124 83 174" stroke="#769879" opacity=".45"/></g>
    <g className="jade-yang"><path d="M130 51A79 79 0 0 1 130 209A39.5 39.5 0 0 0 130 130A39.5 39.5 0 0 1 130 51Z" fill={`url(#${gradient})`} stroke="#dac899" strokeWidth="1.2"/><circle cx="130" cy="90.5" r="9" fill="#173b32"/><path d="M161 74Q202 110 185 165" stroke="#f4e5b6" opacity=".5"/></g>
   </g>
   <circle cx="130" cy="130" r="80" stroke="#dfce9b" opacity=".5"/>
  </svg>
 </div>;
}

type PointRegion='head'|'neck'|'arm'|'hand'|'chest'|'abdomen'|'leg'|'foot';
type PointProfile={region:PointRegion;point:[number,number]};
// Decorative local silhouettes and landmarks; article content remains the knowledge source.
const pointProfiles:Record<string,PointProfile>={
 'point-zusanli':{region:'leg',point:[156,168]},'point-baihui':{region:'head',point:[139,55]},
 'point-yintang':{region:'head',point:[139,135]},'point-fengchi':{region:'neck',point:[159,143]},
 'point-jianjing':{region:'neck',point:[189,181]},'point-quchi':{region:'arm',point:[147,137]},
 'point-hegu':{region:'hand',point:[128,176]},'point-neiguan':{region:'arm',point:[125,232]},
 'point-waiguan':{region:'arm',point:[150,218]},'point-shenmen':{region:'arm',point:[155,265]},
 'point-shanzhong':{region:'chest',point:[139,151]},'point-zhongwan':{region:'abdomen',point:[139,143]},
 'point-guanyuan':{region:'abdomen',point:[139,222]},'point-qihai':{region:'abdomen',point:[139,205]},
 'point-yanglingquan':{region:'leg',point:[174,125]},'point-yinlingquan':{region:'leg',point:[119,135]},
 'point-sanyinjiao':{region:'leg',point:[112,255]},'point-taichong':{region:'foot',point:[145,134]},
 'point-yongquan':{region:'foot',point:[141,190]},'point-taixi':{region:'foot',point:[111,148]}
};
const localSilhouettes:Record<PointRegion,string[]>={
 head:['M139 55C94 53 77 89 81 140L89 166Q106 201 139 211Q175 201 190 166L196 140C201 88 180 53 139 55Z','M104 91Q139 72 175 91M95 134Q108 125 121 134M157 134Q171 125 184 134M139 141L135 163L145 167M117 185Q139 194 160 185M109 199L107 228L75 243L52 285M169 199L172 228L208 243L228 285'],
 neck:['M93 61Q84 107 108 134L112 156Q90 170 59 181L30 207M184 61Q194 108 170 134L166 156Q190 170 220 181L242 207','M103 83Q139 94 175 83M112 134Q139 142 166 134M123 153L123 204M154 153L154 204M59 181Q139 226 220 181M38 227Q139 243 236 227'],
 arm:['M112 40Q129 74 110 111Q95 132 101 153L107 228L103 266Q107 298 119 309L145 315L163 305Q172 284 167 264L174 213L178 152Q172 118 151 108L150 42','M111 112Q130 145 160 120M104 151Q135 159 174 147M107 263Q137 273 166 264M116 295L119 308M127 295L132 313M140 294L145 313M153 290L161 305'],
 hand:['M94 302L91 233Q84 215 82 189L81 138Q85 122 95 127L103 169L102 81Q106 65 116 75L121 150L122 61Q128 49 137 61L140 153L143 79Q148 65 158 78L157 165L169 102Q177 94 183 107L177 178Q196 150 207 158Q216 168 202 187L176 227L175 302','M104 172Q146 181 174 169M98 207Q127 213 154 197M110 239Q137 245 169 229M102 284Q139 294 175 281'],
 chest:['M107 51L106 76Q78 80 54 102L69 179L77 247M171 51L173 76Q202 82 224 102L209 179L201 247','M68 104Q105 90 139 105Q173 90 210 104M76 140Q109 126 130 146M150 146Q175 126 202 140M83 175Q111 188 132 169M148 169Q176 188 195 175M139 105L139 229M92 204Q139 224 186 204M84 230Q139 248 194 230'],
 abdomen:['M73 62Q100 78 139 76Q175 79 205 62L199 111L184 161L186 218Q195 258 207 285M73 62L79 111L94 161L92 218Q83 258 71 285','M88 110Q139 132 190 110M99 154Q139 174 181 154M101 204Q139 214 178 204M91 252Q139 280 187 252M139 103L139 158M139 182L139 249'],
 leg:['M88 38Q99 76 89 100Q83 124 96 159L106 200L107 243L96 287Q105 309 128 308L157 295Q163 279 152 266L167 200L183 143Q190 108 174 82L166 37','M98 113Q130 95 167 118Q166 147 139 159Q107 153 98 113ZM141 159L122 268M114 191Q137 198 163 185M109 280Q128 275 152 287'],
 foot:['M86 35L94 113Q83 147 69 171L76 228Q83 278 112 291L153 295Q179 287 186 262L207 173Q215 130 193 105L165 37','M97 134Q130 115 163 139M98 172Q123 183 175 154M88 226Q118 244 162 211M103 259Q121 271 148 256M172 96Q190 109 198 130M190 145L209 148M185 167L201 172M178 188L194 194']
};
function AcupointMap({id}:{id:string}){
 const gradient=useId().replace(/:/g,''),profile=pointProfiles[id]??{region:'leg' as const,point:[139,175] as [number,number]},[x,y]=profile.point;
 return <svg className="acupoint-map" viewBox="0 0 260 350" fill="none">
  <defs><radialGradient id={gradient}><stop stopColor="#f6dea2" stopOpacity=".75"/><stop offset="1" stopColor="#dfc284" stopOpacity="0"/></radialGradient></defs>
  <g stroke="#c3b783" opacity=".2" strokeWidth=".65"><circle cx={x} cy={y} r="77" strokeDasharray="2 7"/><ellipse cx={x} cy={y} rx="100" ry="38" transform={`rotate(-27 ${x} ${y})`}/><path d="M30 283L66 256L106 277L177 259L222 284M33 71L68 92L190 75L222 53"/></g>
  <g stroke="#acc6ae" strokeWidth="1.25" strokeLinecap="round" opacity=".63">{localSilhouettes[profile.region].map((path,index)=><path key={index} d={path} opacity={index?.65:1}/>)}</g>
  <g fill="#d7c88d" opacity=".45">{[[30,283],[66,256],[106,277],[177,259],[222,284],[33,71],[68,92],[190,75],[222,53]].map(([cx,cy],index)=><circle key={index} cx={cx} cy={cy} r={index%3===0?2:1.5}/>)}</g>
  <circle className="acupoint-glow" cx={x} cy={y} r="27" fill={`url(#${gradient})`}/>
  <g className="acupoint-ripple" stroke="#edcf91" strokeWidth=".9" opacity=".5"><circle cx={x} cy={y} r="15"/><circle cx={x} cy={y} r="24" opacity=".35"/></g>
  <circle className="acupoint-focus" cx={x} cy={y} r="4" fill="#fff0bd"/>
  <path d={`M${x-7} ${y}H${x+7}M${x} ${y-7}V${y+7}`} stroke="#f7e4a5" strokeWidth=".7"/>
 </svg>;
}

function DiagnosisMark({index}:{index:number}){
 return <svg viewBox="0 0 90 90" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
  {index===0&&<><path d="M10 44Q45 12 80 44Q45 76 10 44Z"/><circle cx="45" cy="44" r="12"/><circle cx="45" cy="44" r="4" fill="currentColor"/></>}
  {index===1&&<><path d="M44 16Q61 18 61 34Q61 47 49 51L45 65Q42 76 35 69"/><path d="M27 22Q16 44 27 62M17 17Q2 44 17 69M38 33Q48 24 51 37Q50 45 41 47"/></>}
  {index===2&&<><path d="M14 21H76V61H41L26 75V61H14Z"/><path d="M29 36H61M29 46H53"/></>}
  {index===3&&<><path d="M9 46H24L32 35L39 61L48 19L58 52L67 41H81"/><path d="M14 72H76" opacity=".4"/></>}
 </svg>;
}
function DiagnosisSheets(){
 return <div className="diagnosis-fan">
  {['望','闻','问','切'].map((label,index)=><div key={label} className={`diagnosis-leaf diagnosis-leaf-${index}`}><span>{label}</span><DiagnosisMark index={index}/><i/></div>)}
  <div className="diagnosis-complete"><div>{['望','闻','问','切'].map((label,index)=><span key={label}><DiagnosisMark index={index}/><small>{label}</small></span>)}</div><i/><i/><i/></div>
 </div>;
}
const portraitCells:Record<string,[number,number]>={
 'person-zhangzhongjing':[0,0],'person-sunsimiao':[50,0],'person-lishizhen':[100,0],
 'person-huatuo':[0,100],'person-yetianshi':[50,100]
};
function PhysicianPortrait({item}:{item:Knowledge}){
 const cell=portraitCells[item.id]??[100,100];
 return <><div className="physician-portrait"><span className="physician-halo"/><span className="physician-sprite" style={{backgroundImage:`url(${physicians})`,backgroundPosition:`${cell[0]}% ${cell[1]}%`}}/></div><span className="physician-name-seal">{(item.title.length<4?item.title+'印':item.title).slice(0,4).split('').map((char,index)=><span key={index}>{char}</span>)}</span><span className="physician-ink"/></>;
}

export function KnowledgeSymbol({kind,item}:{kind:SymbolKind;item:Knowledge}){
 return <>
  <span className="knowledge-sheet-frame"/>
  <span className="knowledge-title-slip"><span>{item.title}</span><small>{{theory:'理象藏笺',acupoint:'腧穴星图',diagnosis:'四诊合笺',physician:'名家印谱'}[kind]}</small></span>
  {kind==='theory'&&<><JadeDisc id={item.id}/>{item.id==='theory-yinyang'&&<picture className="card-illustration theory-medallion"><img src={yinYang} width={116} height={116} loading="lazy" decoding="async" alt=""/></picture>}</>}
  {kind==='acupoint'&&<AcupointMap id={item.id}/>}
  {kind==='diagnosis'&&<><DiagnosisSheets/><span className="diagnosis-legend">望 · 闻 · 问 · 切</span></>}
  {kind==='physician'&&<PhysicianPortrait item={item}/>}
  {kind!=='physician'&&<span className="knowledge-sheet-seal">{{theory:'理',acupoint:'穴',diagnosis:'诊',physician:'人'}[kind]}</span>}
  <span className="knowledge-sheet-imprint">{{theory:'阴阳相依 · 观物知理',acupoint:'一穴一星 · 循位而学',diagnosis:'四诊相参 · 合笺知证',physician:'名家留印 · 阅人知学'}[kind]}</span>
 </>;
}
