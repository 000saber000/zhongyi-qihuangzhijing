import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X,UserRound,Cloud,LogIn,LogOut,BookOpen} from 'lucide-react';
import type {useStudy} from '../study/useStudy';
import {isAiOwner} from '../ai/types';
export type Study=ReturnType<typeof useStudy>;
export function Dialog({title,close,children,closable=true}:{title:string;close:()=>void;children:ReactNode;closable?:boolean}){
 const ref=useRef<HTMLElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.querySelector<HTMLElement>('input,button')?.focus();return()=>previous?.focus();},[]);
 return createPortal(<div className="account-backdrop" onClick={()=>{if(closable)close();}}><section ref={ref} className="account-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={event=>event.stopPropagation()} onKeyDown={event=>{
  if(event.key==='Escape'&&closable){event.stopPropagation();close();}
  if(event.key==='Tab'){
   const controls=[...ref.current!.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled)')];
   const first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
 }}>{closable&&<button className="account-close" onClick={close} aria-label="关闭账号窗口"><X size={18}/></button>}<h2>{title}</h2>{children}</section></div>,document.body);
}
export default function AccountPanel({study,onManageAccounts,onManageClassics,onManageModels,onChangePassword}:{study:Study;onManageAccounts:()=>void;onManageClassics?:()=>void;onManageModels?:()=>void;onChangePassword:()=>void}){
 const [open,setOpen]=useState(false),[register,setRegister]=useState(false),[username,setUsername]=useState(''),[password,setPassword]=useState('');
 const status=study.pending.size?'正在保存…':({local:'保存在当前浏览器',loading:'正在读取云端记录…',saving:'正在保存…',synced:'已同步到云端',error:study.user?'同步失败':'本地记录读取失败'})[study.status];
 const close=()=>{if(!study.authBusy){setOpen(false);setPassword('');}};
 return <section className="account-card" aria-label="账户与同步"><div><span className="section-kicker">{study.user?'CLOUD STUDY':'YOUR ACCOUNT'}</span><h3><UserRound size={18}/>{study.user?'账号：'+study.user.username:'登录，让学习足迹相连'}</h3><p>{study.user?'同一账号的收藏与进度可以在不同设备继续。':'游客记录留在当前浏览器。登录后可选择导入并同步到云端。'}</p><span className="account-status"><Cloud size={14}/>{status}</span></div><div className="account-actions">{study.user?<><button className="outline" onClick={onChangePassword} disabled={study.pending.size>0}>修改密码</button>{study.user.role==='admin'&&<><button className="outline" onClick={onManageAccounts}>账号管理</button>{onManageClassics&&<button className="outline" onClick={onManageClassics}><BookOpen size={16}/>知识管理</button>}</>}{onManageModels&&isAiOwner(study.user)&&<button className="outline" onClick={onManageModels}>模型设置</button>}<button className="outline" onClick={()=>void study.refresh()} disabled={study.pending.size>0}>刷新云端记录</button>{(study.guest.bookmarks.length>0||study.guest.completed.length>0)&&<button className="outline" onClick={study.openImport} disabled={study.pending.size>0}>导入本地记录</button>}<button className="section-link" onClick={()=>void study.logout()}><LogOut size={15}/>退出登录</button></>:<button className="primary" onClick={()=>{setRegister(false);setOpen(true);}}><LogIn size={16}/>注册 / 登录</button>}</div>
 {!study.user&&!study.loaded&&<button className="outline" onClick={()=>void study.refresh()}>重新读取本地记录</button>}
 {open&&<Dialog title={register?'注册新账号':'账号登录'} close={close}><form onSubmit={async event=>{event.preventDefault();if(await study.authenticate(username,password,register)){setPassword('');setOpen(false);}}}><label>用户名<input aria-label="用户名" autoComplete="username" required pattern="[A-Za-z0-9_]{3,32}" minLength={3} maxLength={32} value={username} onChange={event=>setUsername(event.target.value)} disabled={study.authBusy}/></label><small>3–32 位字母、数字或下划线，大小写不区分。</small><label>密码<input aria-label="密码" type="password" autoComplete={register?'new-password':'current-password'} required minLength={10} maxLength={128} value={password} onChange={event=>setPassword(event.target.value)} disabled={study.authBusy}/></label><small>{register?'10–128 个字符。请妥善保存密码；忘记密码可联系管理员重置。':'登录后即可读取你的云端学习记录。'}</small>{study.error&&<p className="account-error" role="alert">{study.error}</p>}<button className="primary" disabled={study.authBusy} type="submit">{study.authBusy?'正在连接…':register?'注册并登录':'登录账号'}</button><button className="section-link" disabled={study.authBusy} type="button" onClick={()=>setRegister(!register)}>{register?'已有账号，去登录':'注册新账号'}</button></form></Dialog>}
 {study.user&&study.showImport&&<Dialog title="导入本地学习记录" close={()=>{if(!study.pending.size)study.dismissImport();}}><p>本浏览器有 {study.guest.bookmarks.length} 条收藏、{study.guest.completed.length} 个已完成单元。导入会与当前账号的云端记录合并，本地记录会保留。</p>{study.error&&<p role="alert" className="account-error">{study.error}</p>}<div className="account-actions"><button className="primary" disabled={study.pending.size>0} onClick={()=>void study.importGuest()}>确认导入</button><button className="outline" disabled={study.pending.size>0} onClick={study.dismissImport}>暂不导入</button></div></Dialog>}
 </section>;
}
