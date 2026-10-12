import {useEffect,useRef,useState} from 'react';
import {BookOpen,Plus,Save,Send,Eye,ArrowLeft} from 'lucide-react';
import {knowledge,type Knowledge} from '../../data/catalog';
import {api,ApiError} from '../../lib/api';
import SuggestionReview from '../contributions/SuggestionReview';
import './admin.css';

type Entry={draft:Knowledge;published:Knowledge|null;version:number;updatedAt:string};
type Form=Knowledge & {body:string;keyPoints:string[]};
const blank=():Form=>({id:'',type:'经',title:'',subtitle:'',summary:'',body:'',source:'',tags:[],relations:[],confidence:'待核对',keyPoints:[]});
const formFrom=(item:Knowledge):Form=>({...item,body:item.body??'',keyPoints:item.keyPoints??[]});
const message=(cause:unknown)=>cause instanceof Error?cause.message:'操作失败，请重试。';
export default function ClassicsAdmin({token,authorized=true,onPublished,onDirtyChange}:{token:string;authorized?:boolean;onPublished:()=>Promise<void>;onDirtyChange:(dirty:boolean)=>void}){
 const [entries,setEntries]=useState<Entry[]>([]),[current,setCurrent]=useState<Entry|null>(null),[form,setForm]=useState<Form|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[preview,setPreview]=useState(false),[conflict,setConflict]=useState(false);
 const [reviewing,setReviewing]=useState(false);const blocked=busy||reviewing;
 const baseline=useRef(''),active=useRef(true),editNumber=useRef(0);
 const dirty=!!form&&JSON.stringify(form)!==baseline.current;
 useEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false);},[dirty,onDirtyChange]);
 useEffect(()=>{
  const before=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',before);return()=>window.removeEventListener('beforeunload',before);
 },[dirty]);
 const load=async()=>{
  setLoading(true);if(!conflict)setError('');
  try{const data=await api<{entries:Entry[]}>('/api/admin/classics',{token});if(active.current)setEntries(data.entries);}
  catch(cause){if(active.current)setError(message(cause));}finally{if(active.current)setLoading(false);}
 };
 useEffect(()=>{active.current=true;if(authorized)void load();return()=>{active.current=false;};},[token,authorized]);
 const install=(entry:Entry|null)=>{
  const next=entry?formFrom(entry.draft):blank();baseline.current=JSON.stringify(next);setCurrent(entry);setForm(next);setPreview(false);setError('');setNotice('');setConflict(false);editNumber.current++;
 };
 const choose=(entry:Entry|null)=>{
  if(blocked)return;if(dirty&&!window.confirm('尚有未保存的修改，是否放弃这些修改？'))return;install(entry);
 };
 const change=<K extends keyof Form>(key:K,value:Form[K])=>{setForm(previous=>previous?{...previous,[key]:value}:previous);setNotice('');};
 const updateEntry=(entry:Entry)=>setEntries(previous=>[entry,...previous.filter(item=>item.draft.id!==entry.draft.id)]);
 const fail=(cause:unknown)=>{setError(message(cause));setConflict(cause instanceof ApiError&&cause.code==='VERSION_CONFLICT');};
 const save=async()=>{
  if(!form||blocked||!authorized)return;setBusy(true);setError('');setNotice('');const edit=editNumber.current;
  try{
   const entry=await api<Entry>('/api/admin/classics'+(current?'/'+encodeURIComponent(current.draft.id):''),{method:current?'PUT':'POST',token,body:{content:{...form,tags:form.tags.map(tag=>tag.trim()).filter(Boolean),keyPoints:form.keyPoints.map(point=>point.trim()).filter(Boolean)},...(current?{version:current.version}:{})}});
   if(!active.current||edit!==editNumber.current)return;
   updateEntry(entry);baseline.current=JSON.stringify(formFrom(entry.draft));setCurrent(entry);setForm(formFrom(entry.draft));setConflict(false);setNotice('草稿已保存');
  }catch(cause){if(active.current)fail(cause);}finally{if(active.current)setBusy(false);}
 };
 const publish=async()=>{
  if(!current||dirty||blocked||!authorized)return;setBusy(true);setError('');setNotice('');
  try{
   const entry=await api<Entry>('/api/admin/classics/'+encodeURIComponent(current.draft.id)+'/publish',{method:'POST',token,body:{version:current.version}});
   if(!active.current)return;updateEntry(entry);setCurrent(entry);setNotice('典籍已发布');await onPublished();
  }catch(cause){if(active.current)fail(cause);}finally{if(active.current)setBusy(false);}
 };
 const reload=async()=>{
  if(!current||!window.confirm('重新载入会替换当前输入，是否继续？'))return;
  setBusy(true);
  try{const data=await api<{entries:Entry[]}>('/api/admin/classics',{token});if(!active.current)return;setEntries(data.entries);const latest=data.entries.find(entry=>entry.draft.id===current.draft.id);if(latest)install(latest);}
  catch(cause){if(active.current)fail(cause);}finally{if(active.current)setBusy(false);}
 };
 return <section className="classics-admin" aria-label="典籍管理后台">
  <div className="admin-heading"><div><span className="section-kicker">CLASSICS EDITOR</span><h1>典籍管理</h1><p>先保存草稿，预览核对后发布到知识库。</p></div><button className="primary" onClick={()=>choose(null)} disabled={blocked||loading||!authorized}><Plus size={16}/>新增典籍</button></div>
  {error&&<div role="alert" className="admin-error">{error}{conflict?<button className="outline" onClick={()=>void reload()} disabled={blocked}>重新载入最新版本</button>:!form&&<button className="outline" onClick={()=>void load()} disabled={loading||blocked}>重新读取</button>}</div>}
  {notice&&<div role="status" className="admin-notice">{notice}</div>}
  <SuggestionReview key={token} token={token} authorized={authorized} canMerge={!dirty&&!busy} onBusyChange={setReviewing} onMerged={async classicId=>{const data=await api<{entries:Entry[]}>('/api/admin/classics',{token});if(!active.current)return;setEntries(data.entries);if(current?.draft.id===classicId){const latest=data.entries.find(entry=>entry.draft.id===classicId);if(latest)install(latest);}}}/>
  <div className="admin-layout"><aside className="admin-list" aria-label="典籍列表"><h2>我的典籍目录 <small>{entries.length}</small></h2>{loading?<p>正在读取典籍…</p>:entries.map(entry=><button key={entry.draft.id} className={current?.draft.id===entry.draft.id?'chosen':''} onClick={()=>choose(entry)} disabled={blocked||!authorized}><BookOpen size={15}/><span>{entry.draft.title}<small>{!entry.published?'未发布草稿':JSON.stringify(entry.draft)===JSON.stringify(entry.published)?'已发布':'有未发布修改'}</small></span></button>)}</aside>
   <div className="admin-workspace">{!form?<div className="admin-empty"><BookOpen size={32}/><h2>选择一部典籍，开始编辑。</h2><p>也可以点击“新增典籍”录入新的内容。</p></div>:<>
    <div className="admin-toolbar"><span>{current?`版本 ${current.version} · ${current.published?'已发布':'草稿'}`:'新典籍'}{dirty?' · 尚未保存':''}</span><button className="outline" type="button" disabled={blocked} onClick={()=>setPreview(!preview)}><Eye size={15}/>{preview?'返回编辑':'预览内容'}</button></div>
    {preview?<section className="admin-preview" aria-label="典籍预览"><span className="pill">草稿预览</span><h2>{form.title||'未填写名称'}</h2><p>{form.subtitle}</p><p>{form.summary}</p>{form.body&&<><h3>原文 / 正文</h3><p className="classic-body">{form.body}</p></>}{form.keyPoints.length>0&&<><h3>学习要点</h3><ul>{form.keyPoints.map((point,i)=><li key={i}>{point}</li>)}</ul></>}<h3>文献出处</h3><p>{form.source}</p><button className="section-link" onClick={()=>setPreview(false)}><ArrowLeft size={15}/>返回编辑</button></section>:<form id="classic-form" className="admin-form" onSubmit={event=>{event.preventDefault();void save();}}>
     <fieldset disabled={blocked}><div className="admin-fields"><label>典籍编号<input aria-label="典籍编号" aria-describedby="classic-id-help" required pattern="[a-z][a-z0-9-]{2,79}" maxLength={80} disabled={!!current} value={form.id} placeholder="例如 classic-suwen" onChange={e=>change('id',e.target.value)}/><small id="classic-id-help">字母、数字、短横线；创建后不修改。</small></label><label>典籍名称<input required maxLength={120} value={form.title} onChange={e=>change('title',e.target.value)}/></label></div>
     <label>副标题<input maxLength={240} value={form.subtitle} onChange={e=>change('subtitle',e.target.value)}/></label>
     <label>内容简介<textarea required maxLength={4000} rows={4} value={form.summary} onChange={e=>change('summary',e.target.value)}/></label>
     <label>原文 / 正文<textarea aria-label="原文 / 正文" aria-describedby="classic-body-count" maxLength={50000} rows={12} value={form.body} placeholder="粘贴典籍原文或整理后的正文，保留段落换行。" onChange={e=>change('body',e.target.value)}/><small id="classic-body-count">{form.body.length} / 50000 字符</small></label>
     <label>文献出处<textarea required maxLength={1000} rows={2} value={form.source} placeholder="书名、版本、篇章及页码" onChange={e=>change('source',e.target.value)}/></label>
     <div className="admin-fields"><label>标签（用逗号分隔）<input value={form.tags.join('，')} onChange={e=>change('tags',e.target.value.split(/[,，]/))}/></label><label>来源核对说明<input required maxLength={120} value={form.confidence} onChange={e=>change('confidence',e.target.value)}/></label></div>
     <label>学习要点（每行一条）<textarea rows={4} value={form.keyPoints.join('\n')} onChange={e=>change('keyPoints',e.target.value.split('\n'))}/></label>
     <fieldset className="admin-relations"><legend>关联知识</legend><p>选择已发布知识，让读者沿关联继续阅读。</p><div>{knowledge.filter(item=>item.id!==form.id).map(item=><label key={item.id}><input type="checkbox" checked={form.relations.includes(item.id)} onChange={e=>change('relations',e.target.checked?[...form.relations,item.id]:form.relations.filter(id=>id!==item.id))}/>{item.title}</label>)}</div></fieldset></fieldset>
    </form>}
    <div className="admin-actions"><button className="primary" type={preview?'button':'submit'} form="classic-form" onClick={preview?()=>void save():undefined} disabled={blocked||conflict||!authorized}><Save size={15}/>{busy?'正在处理…':'保存草稿'}</button><button className="outline" onClick={()=>void publish()} disabled={blocked||dirty||!current||conflict||!authorized}><Send size={15}/>发布典籍</button>{current?.published&&<a href={'#knowledge/'+current.draft.id}>查看已发布内容 ↗</a>}<small>{dirty?'修改后需先保存草稿，再发布。':'保存草稿不会改变读者看到的内容。'}</small></div>
   </>}</div>
  </div>
 </section>;
}
