import {useEffect,useMemo,useRef,useState} from 'react';
import {diffChars} from 'diff';
import {api} from '../../lib/api';
import {type Suggestion,type SuggestionPage,type Editable,fieldLabel,statusLabel,displayText,contributionDate,errorMessage} from './types';
import './contributions.css';

function TextDiff({before,after}:{before:string;after:string}){
 const parts=useMemo(()=>diffChars(before,after,{timeout:100,maxEditLength:3000}),[before,after]);
 return parts?<pre className="suggestion-diff">{parts.map((part,i)=>part.added?<ins key={i}>{part.value}</ins>:part.removed?<del key={i}>{part.value}</del>:<span key={i}>{part.value}</span>)}</pre>:<div className="diff-columns"><div><small>修改前</small><pre>{before||'（空）'}</pre></div><div><small>建议内容</small><pre>{after||'（空）'}</pre></div></div>;
}
export default function SuggestionReview({token,authorized,canMerge,onBusyChange,onMerged}:{token:string;authorized:boolean;canMerge:boolean;onBusyChange:(busy:boolean)=>void;onMerged:(classicId:string)=>Promise<void>}){
 const [data,setData]=useState<SuggestionPage|null>(null),[status,setStatus]=useState('pending'),[page,setPage]=useState(1),[selected,setSelected]=useState<Suggestion|null>(null),[note,setNote]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const alive=useRef(true),read=useRef(0);
 useEffect(()=>{onBusyChange(busy);return()=>onBusyChange(false);},[busy,onBusyChange]);
 useEffect(()=>{
  alive.current=true;const current=++read.current;if(!authorized){setData(null);setSelected(null);setLoading(false);return()=>{alive.current=false;read.current++;};}
  setLoading(true);api<SuggestionPage>(`/api/admin/suggestions?status=${status}&page=${page}`,{token}).then(next=>{if(current===read.current){const lastPage=Math.max(1,Math.ceil(next.total/next.pageSize));if(page>lastPage){setPage(lastPage);return;}setData(next);setError('');}}).catch(cause=>{if(current===read.current)setError(errorMessage(cause));}).finally(()=>{if(current===read.current)setLoading(false);});return()=>{alive.current=false;read.current++;};
 },[token,authorized,status,page,refresh]);
 const review=async(action:'merge'|'reject')=>{
  if(!selected||busy||!authorized||(action==='merge'&&!canMerge))return;setBusy(true);setError('');setNotice('');
  try{
   const result=await api<Suggestion>('/api/admin/suggestions/'+selected.id+'/review',{method:'POST',token,body:{action,note}});if(!alive.current)return;
   setSelected({...selected,...result,title:selected.title});setNotice(action==='merge'?'已合并到典籍草稿，尚未发布。请预览确认后手动发布。':'建议已拒绝，处理说明已发送给提交者。');
   if(action==='merge')try{await onMerged(selected.classicId);}catch(cause){if(alive.current)setError('建议已合并，但草稿列表未刷新：'+errorMessage(cause));}
   if(alive.current)setRefresh(value=>value+1);
  }catch(cause){if(alive.current)setError(errorMessage(cause));}finally{if(alive.current)setBusy(false);}
 };
 return <section className="suggestion-review contribution-panel" aria-label="修改建议审核"><div className="contribution-heading"><div><span className="section-kicker">MEMBER CONTRIBUTIONS</span><h2>修改建议审核 <span className="pending-count">{data?.pendingCount??'—'} 待处理</span></h2><p>采纳后合并到草稿，预览确认后再发布。</p></div><button className="outline" disabled={loading||busy||!authorized} onClick={()=>setRefresh(value=>value+1)}>刷新建议</button></div>
 {error&&<p role="alert" className="contribution-error">{error}</p>}{notice&&<p role="status" className="contribution-notice">{notice}</p>}
 <label className="suggestion-filter">处理状态<select aria-label="建议处理状态" value={status} disabled={busy||!authorized} onChange={e=>{setStatus(e.target.value);setPage(1);setSelected(null);setNote('');setNotice('');}}><option value="pending">待审核</option><option value="merged">已合并草稿</option><option value="rejected">已拒绝</option><option value="all">全部建议</option></select></label>
 <div className="suggestion-review-layout"><div className="suggestion-queue">{loading?<p>正在读取建议…</p>:data?.suggestions.length?data.suggestions.map(s=><button className={selected?.id===s.id?'selected':''} key={s.id} aria-label={'审核建议 '+s.title} disabled={busy||!authorized} onClick={()=>{setSelected(s);setNote('');setError('');setNotice('');}}><b>{s.title}</b><small>{s.author} · {contributionDate(s.createdAt)}</small><span>{statusLabel[s.status]}</span></button>):<p>没有{status==='pending'?'待审核的':''}修改建议。</p>}</div>
 {selected&&authorized&&<div className="suggestion-detail"><div className="contribution-row"><h3>{selected.title}</h3><span className={'suggestion-status '+selected.status}>{statusLabel[selected.status]}</span></div><p>提交者：{selected.author} · {contributionDate(selected.createdAt)}</p><h4>修改理由 / 文献依据</h4><p className="suggestion-reason">{selected.reason}</p><small className="diff-legend">红色删除 · 绿色新增</small>{Object.keys(selected.changes).map(field=><div className="suggestion-field" key={field}><h4>{fieldLabel[field as keyof Editable]}</h4><TextDiff before={displayText(selected.base[field as keyof Editable])} after={displayText(selected.changes[field as keyof Editable])}/></div>)}
 {selected.status==='pending'?<><label className="contribution-form">处理说明（选填）<textarea aria-label="处理说明（选填）" rows={3} maxLength={2000} value={note} disabled={busy} onChange={e=>setNote(e.target.value)}/></label>{!canMerge&&<p className="contribution-error">请先保存当前典籍的草稿，再采纳建议。</p>}<div className="contribution-actions"><button className="primary" disabled={busy||!canMerge} onClick={()=>void review('merge')}>采纳并合并草稿</button><button className="outline" disabled={busy} onClick={()=>void review('reject')}>拒绝建议</button></div></>:selected.reviewNote&&<p className="review-note">处理说明：{selected.reviewNote}</p>}</div>}
 </div>{data&&data.total>10&&<div className="contribution-pagination"><button className="outline" disabled={page===1||loading||busy} onClick={()=>setPage(page-1)}>上一页</button><span>第 {page} 页 · {data.total} 条建议</span><button className="outline" disabled={page*data.pageSize>=data.total||loading||busy} onClick={()=>setPage(page+1)}>下一页</button></div>}
 </section>;
}
