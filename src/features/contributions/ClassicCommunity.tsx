import {useEffect,useRef,useState} from 'react';
import type {Knowledge} from '../../data/catalog';
import ChapterEditor from '../../components/ChapterEditor';
import type {Study} from '../account/AccountPanel';
import {api} from '../../lib/api';
import {type CommentPage,type Editable,contributionDate,errorMessage} from './types';
import './contributions.css';

const snapshot=(item:Knowledge)=>({summary:item.summary,body:item.body??'',chapters:item.chapters??[],source:item.source,keyPoints:[...(item.keyPoints??[])]});
export default function ClassicCommunity({item,study}:{item:Knowledge;study:Study}){
 const [data,setData]=useState<CommentPage|null>(null),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[comment,setComment]=useState('');
 const [form,setForm]=useState<ReturnType<typeof snapshot>|null>(null),[base,setBase]=useState<Editable|null>(null),[reason,setReason]=useState('');
 const alive=useRef(true),reads=useRef(0);
 const enabled=!!study.user&&study.loaded&&!study.user.mustChangePassword;
 const load=async(currentPage:number)=>{
  const read=++reads.current;setLoading(true);
  try{const next=await api<CommentPage>(`/api/classics/${encodeURIComponent(item.id)}/comments?page=${currentPage}`);if(alive.current&&reads.current===read){const lastPage=Math.max(1,Math.ceil(next.total/next.pageSize));if(currentPage>lastPage){setPage(lastPage);return;}setData(next);setError('');}}
  catch(cause){if(alive.current&&reads.current===read)setError(errorMessage(cause));}finally{if(alive.current&&reads.current===read)setLoading(false);}
 };
 useEffect(()=>{alive.current=true;void load(page);return()=>{alive.current=false;reads.current++;};},[item.id,page]);
 const publishComment=async()=>{
  if(!enabled||busy)return;setBusy(true);setError('');setNotice('');
  try{await api(`/api/classics/${item.id}/comments`,{method:'POST',token:study.sessionToken,body:{body:comment}});if(!alive.current)return;setComment('');setNotice('评论已发布');if(page===1)await load(1);else setPage(1);}
  catch(cause){if(alive.current)setError(errorMessage(cause));}finally{if(alive.current)setBusy(false);}
 };
 const submit=async()=>{
  if(!enabled||busy||!form||!base)return;setBusy(true);setError('');setNotice('');
  const normalized={...form,keyPoints:form.keyPoints.map(point=>point.trim()).filter(Boolean)};
  const changes:Partial<Editable>={};for(const field of ['summary','body','chapters','source','keyPoints'] as const)if(JSON.stringify(normalized[field])!==JSON.stringify(base[field]))Object.assign(changes,{[field]:normalized[field]});
  try{await api(`/api/classics/${item.id}/suggestions`,{method:'POST',token:study.sessionToken,body:{base,changes,reason}});if(!alive.current)return;setForm(null);setBase(null);setReason('');setNotice('修改建议已提交，等待管理员审核。处理结果可在我的书斋查看。');}
  catch(cause){if(alive.current)setError(errorMessage(cause));}finally{if(alive.current)setBusy(false);}
 };
 const hide=async(commentId:string)=>{
  if(busy||!enabled||study.user?.role!=='admin'||!window.confirm('隐藏这条评论？隐藏后读者将看不到它。'))return;setBusy(true);setError('');setNotice('');
  try{await api('/api/admin/comments/'+commentId,{method:'DELETE',token:study.sessionToken});if(!alive.current)return;setNotice('评论已隐藏');await load(page);}
  catch(cause){if(alive.current)setError(errorMessage(cause));}finally{if(alive.current)setBusy(false);}
 };
 return <section className="classic-community contribution-panel" aria-label="知识讨论">
  <div className="contribution-heading"><div><span className="section-kicker">READ · DISCUSS · CONTRIBUTE</span><h2>知识讨论</h2><p>留下阅读心得，也可以提出有依据的内容修订。</p></div>{enabled&&<button className="outline" disabled={busy} onClick={()=>{if(form){setForm(null);setBase(null);}else{const original=snapshot(item);setBase(original);setForm({...original,keyPoints:[...original.keyPoints]});setReason('');setError('');setNotice('');}}}>{form?'收起修改建议':'建议修改'}</button>}</div>
  {error&&<div role="alert" className="contribution-error">{error}<button className="section-link" disabled={loading||busy} onClick={()=>void load(page)}>重新读取评论</button></div>}
  {notice&&<p role="status" className="contribution-notice">{notice}</p>}
  {!study.user?<p className="contribution-login">登录后可以评论或提交修改建议。<a href="#study">前往登录 →</a></p>:!enabled?<p>正在验证账号，验证完成后即可参与讨论。{study.user.mustChangePassword?'请先修改临时密码。':''}</p>:null}
  {form&&<form className="contribution-form suggestion-form" aria-label="修改建议" onSubmit={event=>{event.preventDefault();void submit();}}><h3>提出修改建议</h3><p>修改内容不会立即生效，管理员采纳后将先合并到草稿。</p><fieldset disabled={busy||!enabled}>
   <label>建议简介<textarea aria-label="建议简介" required maxLength={4000} rows={3} value={form.summary} onChange={e=>setForm({...form,summary:e.target.value})}/></label>
   {item.chapters!==undefined?<ChapterEditor value={form.chapters} onChange={chapters=>setForm({...form,chapters})}/>:<label>建议正文<textarea aria-label="建议正文" maxLength={50000} rows={9} value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/></label>}
   <label>建议出处<textarea aria-label="建议出处" required maxLength={1000} rows={2} value={form.source} onChange={e=>setForm({...form,source:e.target.value})}/></label>
   <label>建议学习要点（每行一条）<textarea aria-label="建议学习要点（每行一条）" rows={3} value={form.keyPoints.join('\n')} onChange={e=>setForm({...form,keyPoints:e.target.value.split('\n')})}/></label>
   <label>修改理由 / 文献依据<textarea aria-label="修改理由 / 文献依据" required maxLength={2000} rows={3} value={reason} onChange={e=>setReason(e.target.value)} placeholder="说明修改原因，以及书名、版本、篇章或页码。"/></label>
   <button className="primary" disabled={!reason.trim()} type="submit">{busy?'正在提交…':'提交修改建议'}</button>
  </fieldset></form>}
  {enabled&&<form className="contribution-form" onSubmit={event=>{event.preventDefault();void publishComment();}}><label>评论内容<textarea aria-label="评论内容" maxLength={2000} required rows={3} value={comment} disabled={busy} onChange={e=>setComment(e.target.value)} placeholder="写下你的阅读心得或问题…"/></label><div className="contribution-actions"><small>{comment.length} / 2000 · 评论公开可见</small><button className="primary" type="submit" disabled={busy||!comment.trim()}>{busy?'正在处理…':'发布评论'}</button></div></form>}
  <div className="contribution-comments" aria-busy={loading}>{loading?<p>正在读取评论…</p>:data?.comments.length?data.comments.map(row=><article className="contribution-comment" key={row.id}><div><b>{row.author}</b><time dateTime={row.createdAt}>{contributionDate(row.createdAt)}</time>{study.user?.role==='admin'&&<button className="section-link" disabled={busy||!enabled} onClick={()=>void hide(row.id)}>隐藏评论</button>}</div><p>{row.body}</p></article>):!error&&<p className="contribution-empty">还没有评论，写下第一份阅读心得吧。</p>}</div>
  {data&&data.total>20&&<div className="contribution-pagination"><button className="outline" disabled={page===1||loading||busy} onClick={()=>setPage(page-1)}>上一页</button><span>第 {page} 页 · {data.total} 条评论</span><button className="outline" disabled={page*data.pageSize>=data.total||loading||busy} onClick={()=>setPage(page+1)}>下一页</button></div>}
 </section>;
}
