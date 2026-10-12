import {useEffect,useRef,useState} from 'react';
import type {Study} from '../account/AccountPanel';
import {api} from '../../lib/api';
import {type SuggestionPage,type Editable,fieldLabel,statusLabel,displayText,contributionDate,errorMessage} from './types';
import './contributions.css';

export default function MySuggestions({study}:{study:Study}){
 const [data,setData]=useState<SuggestionPage|null>(null),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 const read=useRef(0);
 useEffect(()=>{
  const current=++read.current;if(!study.loaded||!study.sessionToken||study.user?.mustChangePassword)return;
  setLoading(true);setError('');api<SuggestionPage>('/api/suggestions/mine?page='+page,{token:study.sessionToken}).then(next=>{if(current===read.current)setData(next);}).catch(cause=>{if(current===read.current)setError(errorMessage(cause));}).finally(()=>{if(current===read.current)setLoading(false);});return()=>{read.current++;};
 },[study.sessionToken,study.loaded,study.user?.mustChangePassword,page,refresh]);
 return <section className="my-suggestions contribution-panel" aria-label="我的修改建议"><div className="contribution-heading"><div><span className="section-kicker">MY CONTRIBUTIONS</span><h2>我的修改建议</h2><p>查看提交的建议及管理员处理结果。</p></div><button className="outline" disabled={loading||!study.loaded} onClick={()=>setRefresh(refresh+1)}>刷新建议</button></div>
 {error&&<p role="alert" className="contribution-error">{error}</p>}
 {loading?<p>正在读取修改建议…</p>:data?.suggestions.length?<div className="my-suggestion-list">{data.suggestions.map(s=><article key={s.id}><div className="contribution-row"><a href={'#knowledge/'+s.classicId}>{s.title}</a><span className={'suggestion-status '+s.status}>{statusLabel[s.status]}</span></div><small>{contributionDate(s.createdAt)}</small><p>{s.reason}</p>{s.reviewNote&&<p className="review-note">管理员说明：{s.reviewNote}</p>}{s.status==='merged'&&<small>已采纳到草稿，正文是否更新以管理员发布为准。</small>}<details><summary>查看建议内容</summary>{Object.keys(s.changes).map(field=><div key={field}><h4>{fieldLabel[field as keyof Editable]}</h4><pre>{displayText(s.changes[field as keyof Editable])||'（空）'}</pre></div>)}</details></article>)}</div>:!error&&<p className="contribution-empty">尚未提交修改建议。阅读知识时可点击“建议修改”。</p>}
 {data&&data.total>10&&<div className="contribution-pagination"><button className="outline" disabled={page===1||loading} onClick={()=>setPage(page-1)}>上一页</button><span>第 {page} 页 · {data.total} 条建议</span><button className="outline" disabled={page*data.pageSize>=data.total||loading} onClick={()=>setPage(page+1)}>下一页</button></div>}
 </section>;
}
