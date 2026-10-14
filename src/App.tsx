import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowRight,ArrowUpRight,BookOpen,Bookmark,Check,ChevronRight,Compass,GraduationCap,Home,Leaf,Library,Menu,Network,Search,Sprout,Sparkles,X} from 'lucide-react';
import KnowledgeCard from './components/KnowledgeCard';
import BookOpening,{type BookSelection} from './components/BookOpening';
import LibraryNavigation from './components/LibraryNavigation';
import ChatPanel from './features/ai/ChatPanel';
import ModelSettings from './features/ai/ModelSettings';
import {isAiOwner} from './features/ai/types';
import type {Knowledge} from './data/catalog';
import Universe from './features/universe/Universe';
import CourseOrbit from './features/courses/CourseOrbit';
import type {CourseVisualHandle} from './features/courses/sceneTypes';
import CourseOpening,{type CourseSelection} from './features/courses/CourseOpening';
import LessonModalFrame from './features/courses/LessonModalFrame';
import {useStudy} from './features/study/useStudy';
import AccountPanel from './features/account/AccountPanel';
import ClassicsAdmin from './features/admin/ClassicsAdmin';
import {useKnowledge} from './features/content/useKnowledge';
import AdminPanel from './features/account/AdminPanel';
import PasswordDialog from './features/account/PasswordDialog';
import ClassicCommunity from './features/contributions/ClassicCommunity';
import MySuggestions from './features/contributions/MySuggestions';
import {categories,categoryLabel,knowledge,highlights,keyPoints,courses,Course} from './data/catalog';
import './features/universe/jade.css';
const nav=[{id:'home',label:'学习首页',icon:Home},{id:'library',label:'知识库',icon:Library},{id:'graph',label:'知识图谱',icon:Network},{id:'courses',label:'学习路径',icon:GraduationCap},{id:'study',label:'我的书斋',icon:Bookmark}];
export default function App(){
 const [route,setRoute]=useState(location.hash.slice(1)||'home');const [query,setQuery]=useState('');const [category,setCategory]=useState('全部');
 const [passwordOpen,setPasswordOpen]=useState(false);
 const [libraryHeaderDocked,setLibraryHeaderDocked]=useState(false);
 const [openingBook,setOpeningBook]=useState<BookSelection|null>(null);
 const bookInFlight=useRef(false),focusAfterBook=useRef(false);
 const revealedBookRoute=useRef<string|null>(null),bookRevealReady=useRef<(()=>void)|null>(null);
 const cancelBook=useCallback(()=>{bookInFlight.current=false;revealedBookRoute.current=null;focusAfterBook.current=false;bookRevealReady.current?.();bookRevealReady.current=null;setOpeningBook(null);},[]);
 useLayoutEffect(()=>{if(route===revealedBookRoute.current){bookRevealReady.current?.();bookRevealReady.current=null;}},[route]);
 useEffect(()=>{if(route!==revealedBookRoute.current)cancelBook();},[route,cancelBook]);
 useEffect(()=>{if(!openingBook&&focusAfterBook.current&&route.startsWith('knowledge/')){document.querySelector<HTMLElement>('.detail-header h1')?.focus();focusAfterBook.current=false;}},[route,openingBook]);
 const [chatOpen,setChatOpen]=useState(false),[chatContext,setChatContext]=useState<Knowledge|null>(null);
 const explain=(item:Knowledge)=>{setChatContext(item);setChatOpen(true);};

 const content=useKnowledge();const dirtyAdmin=useRef(false),acceptedRoute=useRef(route);
 const onAdminDirty=useCallback((dirty:boolean)=>{dirtyAdmin.current=dirty;},[]);
 const study=useStudy();const {bookmarks,completed}=study;
 useEffect(()=>{setChatContext(null);setChatOpen(false);},[study.user?.id]);
 const editorIdentity=useRef<{userId:string;token:string}|null>(null);
 if(route!=='classics')editorIdentity.current=null;
 if(route==='classics'&&study.user?.role==='admin'&&!study.user.mustChangePassword&&study.sessionToken)editorIdentity.current={userId:study.user.id,token:study.sessionToken};
 if(editorIdentity.current&&study.user&&editorIdentity.current.userId!==study.user.id)editorIdentity.current=null;
 const editorAuthorized=study.user?.role==='admin'&&!study.user.mustChangePassword;
 useEffect(()=>setPasswordOpen(false),[study.user?.id]);
const [menu,setMenu]=useState(false);const [lesson,setLesson]=useState<{course:Course;index:number}|null>(null);const [toast,setToast]=useState('');
 const [openingCourse,setOpeningCourse]=useState<CourseSelection|null>(null);
 const courseInFlight=useRef(false),courseRevealReady=useRef<(()=>void)|null>(null);
 const lessonTrigger=useRef<HTMLElement|null>(null);
 const lessonOrigin=useRef<HTMLElement|null>(null),lessonClose=useRef<(()=>void)|null>(null);
 const courseVisual=useRef<CourseVisualHandle|null>(null);
 const cancelCourse=useCallback(()=>{courseInFlight.current=false;setOpeningCourse(null);setLesson(null);courseRevealReady.current?.();courseRevealReady.current=null;},[]);
 const closeLesson=useCallback(()=>{if(lessonClose.current)lessonClose.current();else setLesson(null);},[]);
 useLayoutEffect(()=>{if(lesson&&openingCourse?.course.id===lesson.course.id){courseRevealReady.current?.();courseRevealReady.current=null;}},[lesson,openingCourse]);
 useEffect(()=>{if(route!=='courses'){courseInFlight.current=false;setOpeningCourse(null);courseRevealReady.current?.();courseRevealReady.current=null;lessonOrigin.current=null;lessonTrigger.current=null;}},[route]);
 const nextLesson=(course:Course)=>({course,index:Math.max(0,course.lessons.findIndex((_,i)=>!completed.includes(`${course.id}-${i}`)))});
 const startCourse=(course:Course,origin:HTMLElement,trigger:HTMLElement)=>{
  if(courseInFlight.current||lesson)return;
  lessonOrigin.current=origin;lessonTrigger.current=trigger;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||typeof origin.animate!=='function'||!courseVisual.current){setLesson(nextLesson(course));return;}
  courseInFlight.current=true;setOpeningCourse({course,origin:origin.getBoundingClientRect(),trigger});
 };
 const revealCourse=()=>new Promise<void>(resolve=>{
  if(!openingCourse||route!=='courses'){resolve();return;}
  courseRevealReady.current=resolve;setLesson(nextLesson(openingCourse.course));
 });

 useEffect(()=>{const handler=()=>{if(dirtyAdmin.current&&!window.confirm('尚有未保存的修改，是否放弃这些修改？')){history.replaceState(null,'','#'+acceptedRoute.current);return;}dirtyAdmin.current=false;acceptedRoute.current=location.hash.slice(1)||'home';setRoute(acceptedRoute.current);setMenu(false);setLesson(null);window.scrollTo(0,0)};window.addEventListener('hashchange',handler);return()=>window.removeEventListener('hashchange',handler)},[]);
 useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),2400);return()=>clearTimeout(t)}},[toast]);
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(courseInFlight.current)cancelCourse();else closeLesson();}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[cancelCourse,closeLesson]);
 const go=(page:string)=>{if(page==='library'){setQuery('');setCategory('全部')}location.hash=page;setMenu(false);setLesson(null)};
 const open=(id:string,trigger?:HTMLButtonElement)=>{
  if(bookInFlight.current)return;
  const item=knowledge.find(entry=>entry.id===id),cover=trigger?.querySelector('.knowledge-artwork');
  if(item&&trigger&&cover&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
   bookInFlight.current=true;setOpeningBook({item,origin:cover.getBoundingClientRect(),saved:bookmarks.includes(id)});return;
  }
  location.hash=`knowledge/${id}`;
 };
 const revealBook=()=>new Promise<void>(resolve=>{const id=openingBook?.item.id;if(!id){resolve();return;}const target=`knowledge/${id}`;revealedBookRoute.current=target;if(route===target){resolve();return;}bookRevealReady.current=resolve;location.hash=target;});
 const finishBook=()=>{cancelBook();focusAfterBook.current=true;};
 const search=(e:React.FormEvent)=>{e.preventDefault();setCategory('全部');location.hash='library';};
 const active=route.startsWith('knowledge/')?'library':route;
 const detail=route.startsWith('knowledge/')?knowledge.find(k=>k.id===route.slice(10)):null;
 const filtered=knowledge.filter(k=>(category==='全部'||k.type===category)&&`${k.title} ${k.subtitle} ${k.summary} ${k.tags.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
 const toggle=(id:string)=>{void study.toggleBookmark(id);};
 const totalCompleted=completed.filter(id=>courses.some(c=>c.lessons.some((_,i)=>`${c.id}-${i}`===id))).length;

 const isCosmos=route==='home'||route==='graph'||route.startsWith('universe/');
 return <><Universe pendingBookmarks={study.pending} studyReady={study.loaded&&!study.pending.has('import')} onExplain={explain} initialId={route.startsWith('universe/')?route.slice(9):null} bookmarks={bookmarks} onToggle={toggle} onNavigate={go} contentMode={!isCosmos} libraryHeaderDocked={libraryHeaderDocked} activePage={isCosmos?'home':active} contentKey={route} queryValue={query} onQueryChange={setQuery} onQuerySubmit={search}>
 {!isCosmos&&<div className="page-content unified-content">
 {content.error&&<div className="content-sync">{content.error}<button className="outline" disabled={content.loading} onClick={()=>void content.refresh()}>重试同步内容</button></div>}
 {route==='classics'&&(editorIdentity.current?<>{!editorAuthorized&&<><div className="admin-error">登录状态或管理权限已变化，未保存内容已保留。请重新登录管理员账号后继续。</div><AccountPanel study={study} onManageAccounts={()=>go('admin')} onChangePassword={()=>setPasswordOpen(true)}/></>}<ClassicsAdmin key={editorIdentity.current.userId} token={editorIdentity.current.token} authorized={editorAuthorized} onPublished={content.refresh} onDirtyChange={onAdminDirty}/></>:<div className="empty"><BookOpen size={32}/><h2>知识管理</h2><p>{study.user?'此功能仅供管理员使用。':'请先登录管理员账号。'}</p><button className="primary" onClick={()=>go('study')}>前往我的书斋</button></div>)}

 {route==='library'&&<><PageTitle kicker="KNOWLEDGE LIBRARY" title="知识库" description="汇聚中医智慧 · 探索生命之道"/><LibraryNavigation category={category} onChange={setCategory} onHeaderDockedChange={setLibraryHeaderDocked}/><div className="results-info"><span>{query?`“${query}” 的搜索结果`:'知识目录'} · {filtered.length} 个条目</span>{(query||category!=='全部')&&<button className="section-link" onClick={()=>{setQuery('');setCategory('全部')}}>清空筛选 <X size={14}/></button>}</div>{filtered.length?<div className="knowledge-grid library-grid">{filtered.map(item=><KnowledgeCard key={item.id} item={item} onOpen={open} saved={bookmarks.includes(item.id)}/>)}</div>:<div className="empty"><Search size={38}/><h3>暂未找到相关知识</h3><p>试试“阴阳”“桂枝汤”或“黄帝内经”。</p></div>}</>}
 {route==='courses'&&<><PageTitle kicker="LEARNING PATHS" title="循序而学，自成体系。" description="先建立框架，再读经典。从一个概念开始，让每一步学习有所收获。"/><CourseOrbit visual={courseVisual} completed={completed} activeCourse={openingCourse?.course.id??lesson?.course.id??null} onStart={startCourse}/><div className="learning-note"><BookOpen size={23}/><div><h3>慢慢读，认真想，反复相连。</h3><p>每条路径包含五个导读单元。记录你的完成状态，随时可以重新阅读。</p></div></div></>}
 {route==='study'&&<><PageTitle kicker="MY STUDY" title="我的书斋" description="把值得重读的知识留下，把每一小步学习记住。"/><AccountPanel study={study} onManageAccounts={()=>go('admin')} onManageClassics={()=>go('classics')} onManageModels={()=>go('ai-settings')} onChangePassword={()=>setPasswordOpen(true)}/><div className="study-stats"><div><Bookmark size={23}/><b>{study.loaded?bookmarks.length:'—'}</b><span>收藏的知识</span></div><div><GraduationCap size={23}/><b>{study.loaded?totalCompleted:'—'}</b><span>已完成单元</span></div><div><Leaf size={23}/><b>由你</b><span>决定学习的节奏</span></div></div>{study.user&&<MySuggestions key={study.user.id+study.sessionToken} study={study}/>}<div className="section-head"><h2>我的收藏</h2><span className="muted">{study.user?'云端学习记录':study.loaded?'保存在当前浏览器':'本地记录未能读取'}</span></div>{!study.loaded?<div className="empty"><p>{study.user?.mustChangePassword?'请先修改临时密码，再读取学习记录。':!study.user?'本地记录未能读取，请重新读取本地记录。':study.status==='error'?'云端记录未能读取，请点击刷新云端记录重试。':'正在读取云端记录…'}</p></div>:bookmarks.length?<div className="knowledge-grid">{knowledge.filter(k=>bookmarks.includes(k.id)).map(item=><KnowledgeCard key={item.id} item={item} onOpen={open} saved/>)}</div>:<div className="empty"><Bookmark size={34}/><h3>书斋尚静，等待第一份收藏。</h3><p>读到感兴趣的知识时，点击收藏，就能在这里找到它。</p><button className="primary" onClick={()=>go('library')}>去发现知识 <ArrowRight size={16}/></button></div>}</>}
 {route.startsWith('knowledge/')&&(detail?<article className="detail-page"><button className="section-link" onClick={()=>go('library')}>← 返回知识库</button><div className="detail-header"><div><span className="section-kicker">{categoryLabel(detail.type)} · KNOWLEDGE</span><h1 tabIndex={-1}>{detail.title}</h1><p>{detail.subtitle}</p></div><button className={bookmarks.includes(detail.id)?'primary':'outline'} disabled={!study.loaded||study.pending.has('import')||study.pending.has('bookmark:'+detail.id)} aria-label={bookmarks.includes(detail.id)?'取消收藏':'收藏知识'} onClick={()=>toggle(detail.id)}><Bookmark size={17} fill={bookmarks.includes(detail.id)?'currentColor':'none'}/>{bookmarks.includes(detail.id)?'已收藏':'收藏知识'}</button></div><div className="detail-columns"><div className="reading-panel"><span className="pill">知识导读</span><h2>先认识，再理解。</h2><p className="lead">{detail.summary}</p><button className="ai-explain" onClick={()=>explain(detail)}><Sparkles size={15}/>请 AI 讲解</button>{detail.body&&<section aria-label="知识正文"><h3>原文 / 正文</h3><p className="classic-body">{detail.body}</p></section>}<h3>学习时，关注这些线索</h3>{(keyPoints[detail.id]||['先辨识本条目的核心概念，再结合来源说明与相关条目理解其语境。','沿下方关联知识继续阅读，比较概念之间的区别与联系。','本条目来自用户提供素材，具体文献版本与表述仍需核对。']).map((p,i)=><div className="learning-point" key={p}><span>0{i+1}</span><p>{p}</p></div>)}<div className="source-box"><BookOpen size={18}/><div><b>来源说明</b><p>{detail.source}</p><small>用户提供素材 · 具体出处待核对。本站内容用于学习与文献理解。</small></div></div></div><aside className="related-panel"><span className="section-kicker">FOLLOW THE CONNECTIONS</span><h3>继续探索</h3>{detail.relations.map(id=>{const k=knowledge.find(n=>n.id===id);return k&&<button className="relation-row" key={id} onClick={()=>open(id)}><span>{k.title}<small>{categoryLabel(k.type)}</small></span><ArrowUpRight size={16}/></button>})}<button className="outline" onClick={()=>go('graph')}><Network size={17}/> 在图谱中探索</button></aside></div>{<ClassicCommunity key={detail.id+(study.user?.id??'guest')+study.sessionToken} item={detail} study={study}/>}</article>:<div className="empty"><h2>未找到这个知识条目</h2><button className="primary" onClick={()=>go('library')}>返回知识库</button></div>)}
 {route==='ai-settings'&&(isAiOwner(study.user)?<ModelSettings key={study.user!.id+study.sessionToken} study={study} back={()=>go('study')}/>:<div className="empty"><h2>此功能仅供指定管理员使用。</h2><button className="primary" onClick={()=>go('study')}>返回我的书斋</button></div>)}
 {route==='admin'&&(study.user?.role==='admin'?<AdminPanel key={study.user.id+study.sessionToken} study={study} back={()=>go('study')}/>:<div className="empty"><h2>需要管理员权限。</h2><button className="primary" onClick={()=>go('study')}>返回我的书斋</button></div>)}
 {!nav.some(n=>n.id===route)&&route!=='admin'&&route!=='classics'&&route!=='ai-settings'&&!route.startsWith('knowledge/')&&<div className="empty"><h2>这个页面暂不存在</h2><button className="primary" onClick={()=>go('home')}>返回首页</button></div>}
 <footer><span><Sprout size={14}/> 岐黄知境 · 让学习生根，让知识相连</span><small>学习用途 · 内容来源待核对</small></footer>
 </div>}
 {lesson&&<LessonModalFrame trigger={lessonTrigger.current} origin={lessonOrigin.current} closeRef={lessonClose} onClosed={()=>setLesson(null)} opening={!!openingCourse}><button className="modal-close" onClick={closeLesson} aria-label="关闭学习单元"><X size={20}/></button><span className="section-kicker">{lesson.course.title}</span><div className="lesson-tabs">{lesson.course.lessons.map((name,i)=><button key={name} className={i===lesson.index?'current':''} aria-label={`第${i+1}节 ${name}`} onClick={()=>setLesson({...lesson,index:i})}>{completed.includes(`${lesson.course.id}-${i}`)?<Check size={14}/>:i+1}</button>)}</div><h2 id="lesson-title">{lesson.course.lessons[lesson.index]}</h2><p>{knowledge.find(k=>k.id===lesson.course.ids[lesson.index])?.summary||'沿着相关知识的关联，逐步建立理解。'}</p><button className="ai-explain" onClick={()=>{const item=knowledge.find(k=>k.id===lesson.course.ids[lesson.index]);if(item){setLesson(null);explain(item);}}}><Sparkles size={15}/>请 AI 讲解</button><h4>本节学习要点</h4>{(keyPoints[lesson.course.ids[lesson.index]]||['理解概念在经典和教材中的语境。','阅读相关知识，辨析概念之间的联系。']).map(p=><p className="lesson-point" key={p}><Leaf size={15}/>{p}</p>)}<button className="section-link" onClick={()=>{open(lesson.course.ids[lesson.index]);setLesson(null)}}>阅读相关知识 <ArrowUpRight size={16}/></button><div className="lesson-actions"><span>{lesson.course.lessons.filter((_,i)=>completed.includes(`${lesson.course.id}-${i}`)).length} / 5 单元已完成</span><button className="primary" aria-label="完成本节学习" disabled={!study.loaded||study.pending.has('import')||study.pending.has('lesson:'+lesson.course.id+'-'+lesson.index)} onClick={async()=>{const id=lesson.course.id+'-'+lesson.index;if(await study.completeLesson(id))setToast('学习足迹已记录')}}><Check size={16}/>{completed.includes(`${lesson.course.id}-${lesson.index}`)?'本节已完成':'完成本节学习'}</button></div></LessonModalFrame>}
 {toast&&<div role="status" className="toast"><Check size={16}/>{toast}</div>}
 </Universe>{route==='courses'&&openingCourse&&<CourseOpening visual={courseVisual} selection={openingCourse} onReveal={revealCourse} onFinish={()=>{courseInFlight.current=false;setOpeningCourse(null);}} onCancel={cancelCourse}/>} {openingBook&&<BookOpening selection={openingBook} onReveal={revealBook} onFinish={finishBook} onCancel={cancelBook}/>} {isCosmos&&content.error&&<div className="content-sync cosmic-sync">{content.error}<button className="outline" disabled={content.loading} onClick={()=>void content.refresh()}>重试同步内容</button></div>}{study.user&&(passwordOpen||study.user.mustChangePassword)&&<PasswordDialog key={study.user.id} study={study} close={()=>setPasswordOpen(false)}/>} {study.error&&<div role="alert" className="toast">{study.error}</div>} {<button className="ai-launcher" aria-hidden={chatOpen} tabIndex={chatOpen?-1:0} aria-label="问岐黄" onClick={()=>setChatOpen(true)}><Sparkles size={17}/>问岐黄</button>}<ChatPanel key={(study.user?.id??'guest')+study.sessionToken} study={study} open={chatOpen} context={chatContext} onClose={()=>setChatOpen(false)} onClearContext={()=>setChatContext(null)} onNavigate={go}/></>
}
function PageTitle({kicker,title,description}:{kicker:string;title:string;description:string}){return <div className="page-title"><span className="section-kicker">{kicker}</span><h1>{title}</h1><p>{description}</p></div>}
