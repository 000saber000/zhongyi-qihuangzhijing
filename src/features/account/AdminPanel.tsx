import {useCallback,useEffect,useRef,useState} from 'react';
import {api,ApiError} from '../../lib/api';
import {Dialog,type Study} from './AccountPanel';
type User={id:string;username:string;role:'user'|'admin';disabled:boolean;mustChangePassword:boolean;createdAt:string;bookmarkCount:number;completedCount:number;activeSessions:number};
type List={users:User[];total:number;page:number;pageSize:number};
type Audit={id:string;actorUsername:string;targetUsername:string;action:string;createdAt:string};
type Action='disable'|'enable'|'revoke_sessions'|'reset_password'|'delete';
const labels:Record<string,string>={bootstrap:'设置管理员',disable:'禁用账号',enable:'恢复账号',revoke_sessions:'强制退出',reset_password:'重置密码',delete:'删除账号'};
const confirm:Record<Action,string>={disable:'确认禁用',enable:'确认恢复',revoke_sessions:'确认强制退出',reset_password:'确认重置',delete:'确认删除'};
const date=(value:string)=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
export default function AdminPanel({study,back}:{study:Study;back:()=>void}){
 const [query,setQuery]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(1),[data,setData]=useState<List|null>(null),[audit,setAudit]=useState<Audit[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [selection,setSelection]=useState<{user:User;action:Action}|null>(null),[adminPassword,setAdminPassword]=useState(''),[confirmUsername,setConfirmUsername]=useState(''),[temporary,setTemporary]=useState(''),[busy,setBusy]=useState(false),[dialogError,setDialogError]=useState('');
 const mounted=useRef(false),read=useRef(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;read.current++;};},[]);
 const failed=async(cause:unknown,set:(value:string)=>void)=>{if(!mounted.current)return;if(cause instanceof ApiError&&cause.status===401){void study.logout();return;}set(cause instanceof Error?cause.message:'操作失败，请重试。');};
 const refresh=useCallback(async()=>{
  const generation=++read.current;setLoading(true);setError('');
  try{const [users,logs]=await Promise.all([api<List>('/api/admin/users?q='+encodeURIComponent(search)+'&page='+page,{token:study.sessionToken}),api<{actions:Audit[]}>('/api/admin/audit',{token:study.sessionToken})]);if(mounted.current&&generation===read.current){setData(users);setAudit(logs.actions);}}
  catch(cause){if(generation===read.current)void failed(cause,setError);}finally{if(mounted.current&&generation===read.current)setLoading(false);}
 },[search,page,study.sessionToken]);
 useEffect(()=>{setData(null);void refresh();},[refresh]);
 const close=()=>{if(busy)return;setSelection(null);setTemporary('');setAdminPassword('');setConfirmUsername('');setDialogError('');};
 const choose=(user:User,action:Action)=>{setSelection({user,action});setAdminPassword('');setConfirmUsername('');setTemporary('');setDialogError('');setMessage('');};
 const submit=async()=>{
  if(!selection||busy)return;setBusy(true);setDialogError('');const {user,action}=selection,base='/api/admin/users/'+user.id;
  try{
   if(action==='reset_password'){
    const result=await api<{temporaryPassword:string}>(base+'/reset-password',{method:'POST',token:study.sessionToken,body:{adminPassword}});
    if(!mounted.current)return;setTemporary(result.temporaryPassword);setAdminPassword('');
   }else{
    await api(base+(action==='delete'?'':action==='revoke_sessions'?'/revoke-sessions':'/status'),{method:action==='delete'?'DELETE':action==='revoke_sessions'?'POST':'PUT',token:study.sessionToken,body:action==='delete'?{adminPassword,confirmUsername}:action==='revoke_sessions'?undefined:{disabled:action==='disable'}});
    if(!mounted.current)return;setSelection(null);setAdminPassword('');setConfirmUsername('');setMessage(labels[action]+'已完成。');
   }
   void refresh();
  }catch(cause){void failed(cause,setDialogError);}finally{if(mounted.current)setBusy(false);}
 };
 return <section className="admin-panel"><span className="section-kicker">ACCOUNT ADMINISTRATION</span><h1>账号管理</h1><p>查看与管理网站账号，操作会保留记录。时间为北京时间。</p><div className="account-actions"><button className="outline" onClick={back}>返回我的书斋</button><button className="outline" disabled={loading||busy} onClick={()=>void refresh()}>刷新账号列表</button><button className="section-link" onClick={()=>void study.logout()}>退出登录</button></div>
 <form className="admin-search" onSubmit={e=>{e.preventDefault();setSearch(query.trim());setPage(1);if(query.trim()===search&&page===1)void refresh();}}><label>搜索用户名<input aria-label="搜索用户名" maxLength={32} value={query} onChange={e=>setQuery(e.target.value)} placeholder="输入用户名片段"/></label><button className="primary" type="submit" disabled={busy}>搜索账号</button></form>
 {message&&<p role="status">{message}</p>}{error&&<p role="alert" className="account-error">{error} <button className="outline" onClick={()=>void refresh()}>重试读取账号</button></p>}{loading&&<p role="status">正在读取账号…</p>}
 {data&&<><p>共 {data.total} 个账号 · 第 {data.page} 页</p><div className="admin-users">{data.users.map(user=><article className="admin-user" key={user.id} aria-label={'账号 '+user.username}><div className="admin-user-head"><h3>{user.username}</h3><span>{user.role==='admin'?'管理员':user.disabled?'已禁用':user.mustChangePassword?'待修改密码':'正常'}</span></div><p>注册于 {date(user.createdAt)}</p><p>收藏 {user.bookmarkCount} · 已完成 {user.completedCount} · 有效会话 {user.activeSessions}</p>{user.role==='admin'?<small>管理员账号受保护，请在我的书斋修改自己的密码。</small>:<div className="account-actions">{([user.disabled?'enable':'disable','revoke_sessions','reset_password','delete'] as Action[]).map(action=><button className="outline" disabled={busy||loading} key={action} onClick={()=>choose(user,action)}>{labels[action]}</button>)}</div>}</article>)}</div>{!data.users.length&&<p>没有匹配的账号。</p>}<div className="account-actions"><button className="outline" disabled={page===1||loading||busy} onClick={()=>setPage(page-1)}>上一页</button><button className="outline" disabled={page*data.pageSize>=data.total||loading||busy} onClick={()=>setPage(page+1)}>下一页</button></div></>}
 <h2>最近操作</h2><ul className="admin-audit">{audit.map(item=><li key={item.id}><b>{labels[item.action]||item.action} · {item.targetUsername}</b><small>{item.actorUsername} · {date(item.createdAt)}</small></li>)}</ul>
 {selection&&<Dialog title={labels[selection.action]+'：'+selection.user.username} close={close}>{temporary?<><p>请立即保存并交给该用户。关闭后不会再次显示；用户登录后必须修改。</p><label>临时密码<input aria-label="临时密码" readOnly value={temporary}/></label><button className="primary" onClick={close}>已保存，关闭</button></>:<form onSubmit={e=>{e.preventDefault();void submit();}}><p>{selection.action==='delete'?'将永久删除该账号及其收藏、学习进度和全部登录会话。':selection.action==='disable'?'禁用后无法登录，现有登录会话立即撤销，学习记录保留。':selection.action==='enable'?'恢复后用户可以重新登录，旧会话不会恢复。':selection.action==='revoke_sessions'?'使所有设备退出登录，用户仍可使用原密码重新登录。':'生成一次性临时密码，撤销现有会话，用户登录后必须修改密码。'}</p>{(selection.action==='delete'||selection.action==='reset_password')&&<label>管理员当前密码<input aria-label="管理员当前密码" type="password" autoComplete="current-password" minLength={10} maxLength={128} required value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} disabled={busy}/></label>}{selection.action==='delete'&&<label>确认删除的用户名<input aria-label="确认删除的用户名" required value={confirmUsername} onChange={e=>setConfirmUsername(e.target.value)} disabled={busy}/></label>}{dialogError&&<p role="alert" className="account-error">{dialogError}</p>}<button type="submit" className="primary" disabled={busy||(selection.action==='delete'&&confirmUsername!==selection.user.username)}>{busy?'正在处理…':confirm[selection.action]}</button></form>}</Dialog>}
 </section>;
}
