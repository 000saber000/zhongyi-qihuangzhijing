import {useState} from 'react';
import {Dialog,type Study} from './AccountPanel';
export default function PasswordDialog({study,close}:{study:Study;close:()=>void}){
 const forced=study.user?.mustChangePassword;
 const [current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirmation,setConfirmation]=useState(''),[error,setError]=useState('');
 return <Dialog title={forced?'请修改临时密码':'修改密码'} closable={!forced} close={()=>{if(!study.authBusy)close();}}><p>{forced?'请先将临时密码改为自己的密码，再继续学习。':'修改后其他设备需要重新登录。'}</p><form onSubmit={async event=>{event.preventDefault();setError('');if(next!==confirmation){setError('两次新密码不一致。');return;}if(next===current){setError('新密码必须与当前密码不同。');return;}if(await study.changePassword(current,next))close();}}>
 <label>当前密码<input aria-label="当前密码" type="password" autoComplete="current-password" required minLength={10} maxLength={128} value={current} onChange={e=>setCurrent(e.target.value)} disabled={study.authBusy}/></label>
 <label>新密码<input aria-label="新密码" type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={next} onChange={e=>setNext(e.target.value)} disabled={study.authBusy}/></label>
 <label>确认新密码<input aria-label="确认新密码" type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={study.authBusy}/></label>
 <small>10–128 个字符。</small>{(error||study.error)&&<p role="alert" className="account-error">{error||study.error}</p>}<button type="submit" className="primary" disabled={study.authBusy||study.pending.size>0}>{study.authBusy?'正在修改…':'保存新密码'}</button><button type="button" className="section-link" onClick={()=>{close();void study.logout();}}>退出登录</button></form></Dialog>;
}
