import './navigation.css';

type Page='home'|'library'|'meridians'|'courses'|'study';
const entries:{id:Page;label:string;accessibleName:string}[]=[
 {id:'home',label:'知识宇宙',accessibleName:'知识图谱'},
 {id:'library',label:'知识库',accessibleName:'知识库'},
 {id:'meridians',label:'经络云图',accessibleName:'经络云图'},
 {id:'courses',label:'学习路径',accessibleName:'学习路径'},
 {id:'study',label:'我的书斋',accessibleName:'我的书斋'}
];
function NavigationGlyph({page}:{page:Page}){
 return <svg className="cosmic-nav-icon" viewBox="0 0 26 26" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round">
  {page==='home'&&<><circle cx="13" cy="13" r="8.8"/><ellipse cx="13" cy="13" rx="12" ry="4.2" transform="rotate(-35 13 13)"/><circle cx="13" cy="13" r="1.5" fill="currentColor" stroke="none"/><circle cx="22" cy="7" r="1.2" fill="currentColor" stroke="none"/></>}
  {page==='library'&&<><path d="M5 3.5h14l2 2v17H5zM17.5 3.5v19M8 7h5M8 10h5M8 18h3"/><path d="M3 6v18h15M16 7h3M16 12h3M16 17h3"/></>}
  {page==='courses'&&<><path d="M5 21V5h16v16z" opacity=".45"/><path d="M6.5 18.5l6.5-5.5 6.5-5.5"/><circle cx="6.5" cy="18.5" r="2.1"/><circle cx="13" cy="13" r="2.1"/><circle cx="19.5" cy="7.5" r="2.1"/></>}
  {page==='meridians'&&<><path d="M13 6v16M8 10l-4 6M18 10l4 6M9 21l4-6 4 6M8 10h10"/><circle cx="13" cy="3.5" r="2"/><circle cx="13" cy="11" r="1.1"/><circle cx="8" cy="10" r="1.1"/><circle cx="18" cy="10" r="1.1"/></>}
  {page==='study'&&<><path d="M4 3.5h18v19H4zM7 6.5h12v13H7z"/><text x="13" y="16.5" textAnchor="middle" fontFamily="var(--serif)" fontSize="10.5" fill="currentColor" stroke="none">斋</text></>}
 </svg>;
}
const frame='M9 1H127L135 9V33L127 41H9L1 33V9Z';
export default function CosmicNavigation({activePage,onHome,onNavigate}:{activePage:string;onHome:()=>void;onNavigate:(page:string)=>void}){
 return <nav className="universe-nav cosmic-navigation" aria-label="主导航">{entries.map(entry=><button type="button" key={entry.id} className={`cosmic-nav-link${activePage===entry.id?' current':''}`} aria-label={entry.accessibleName} aria-current={activePage===entry.id?'page':undefined} onClick={()=>entry.id==='home'?onHome():onNavigate(entry.id)}>
  <svg className="cosmic-nav-frame" viewBox="0 0 136 42" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path className="cosmic-nav-track" d={frame}/><path className="cosmic-nav-trace" d={frame} pathLength="1"/></svg>
  <NavigationGlyph page={entry.id}/><span className="cosmic-nav-label">{entry.label}</span><i className="cosmic-nav-dot" aria-hidden="true"/>
 </button>)}</nav>;
}
