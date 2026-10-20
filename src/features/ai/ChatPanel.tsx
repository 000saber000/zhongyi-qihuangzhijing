import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUp,BookOpen,MessageCircle,Plus,Square,Sparkles,X} from 'lucide-react';
import type {Knowledge} from '../../data/catalog';
import {api,ApiError} from '../../lib/api';
import type {Study} from '../account/AccountPanel';
import {streamChat} from './client';
import MarkdownText from './MarkdownText';
import type {AiStatus,Message,Source} from './types';
import './ai.css';
type Exchange={id:number;question:string;answer:string;sources:Source[];state:'loading'|'complete'|'error'|'stopped';thinking?:boolean;error?:string};
export default function ChatPanel({study,open,context,draftPrompt,onClose,onClearContext,onNavigate}:{study:Study;open:boolean;context:Knowledge|null;draftPrompt:{id:number;text:string}|null;onClose:()=>void;onClearContext:()=>void;onNavigate:(route:string)=>void}){
 const [exchanges,setExchanges]=useState<Exchange[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState<AiStatus|null>(null),[statusError,setStatusError]=useState('');
 const panel=useRef<HTMLElement>(null),input=useRef<HTMLTextAreaElement>(null),scroll=useRef<HTMLDivElement>(null),controller=useRef<AbortController|null>(null),sequence=useRef(0),mounted=useRef(true),statusRead=useRef(0),counter=useRef(0),focusPending=useRef(false);
 const refresh=async()=>{if(!study.sessionToken)return;const read=++statusRead.current;setStatusError('');try{const value=await api<AiStatus>('/api/ai/status',{token:study.sessionToken});if(mounted.current&&read===statusRead.current)setStatus(value);}catch(cause){if(mounted.current&&read===statusRead.current){setStatus(null);setStatusError(cause instanceof Error?cause.message:'无法读取助手状态。');}}};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;sequence.current++;statusRead.current++;controller.current?.abort();};},[]);
 useEffect(()=>{if(open){if(study.user&&!study.user.mustChangePassword)void refresh();const previous=document.activeElement as HTMLElement|null;focusPending.current=Boolean(study.user&&input.current?.disabled);const field=input.current&&!input.current.disabled?input.current:panel.current?.querySelector<HTMLElement>('button');field?.focus();return()=>previous?.focus();}controller.current?.abort();},[open]);
 useEffect(()=>{if(context){setText('请用初学者能理解的话讲解“'+context.title+'”，并给出学习线索。');input.current?.focus();}},[context?.id]);
 useEffect(()=>{if(draftPrompt){setText(draftPrompt.text);input.current?.focus();}},[draftPrompt?.id]);
 useEffect(()=>{if(scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;},[exchanges]);
 const available=study.user&&!study.user.mustChangePassword&&status?.enabled&&status.globalAvailable&&status.remaining>0;
 useEffect(()=>{if(open&&available&&focusPending.current){focusPending.current=false;input.current?.focus();}},[open,available]);
 const send=async(question:string,retryId?:number)=>{
  question=question.trim();if(!question||question.length>3000||busy||!available||!study.sessionToken)return;
  const current=++sequence.current,id=retryId??++counter.current,abort=new AbortController();controller.current=abort;setBusy(true);setText('');
  const pairs=exchanges.filter(item=>item.state==='complete'&&item.id!==retryId).slice(-3).map(item=>[{role:'user' as const,content:item.question},{role:'assistant' as const,content:item.answer.slice(0,3000)}]);
  while(pairs.flat().reduce((total,m)=>total+m.content.length,question.length)>12000)pairs.shift();
  const messages:Message[]=[...pairs.flat(),{role:'user',content:question}];
  const exchange:Exchange={id,question,answer:'',sources:[],state:'loading'};setExchanges(items=>retryId?items.map(item=>item.id===retryId?exchange:item):[...items,exchange]);
  const update=(change:(item:Exchange)=>Exchange)=>{if(mounted.current&&current===sequence.current)setExchanges(items=>items.map(item=>item.id===id?change(item):item));};
  try{
   await streamChat(study.sessionToken,messages,context?.id,abort.signal,event=>{
    if(event.type==='meta'){update(item=>({...item,sources:event.sources}));if(mounted.current&&current===sequence.current)setStatus(value=>value?{...value,remaining:event.remaining}:value);}
    if(event.type==='delta')update(item=>({...item,answer:item.answer+event.text}));
    if(event.type==='progress')update(item=>({...item,thinking:true}));
   });update(item=>({...item,state:'complete'}));
  }catch(cause){
   update(item=>({...item,state:abort.signal.aborted?'stopped':'error',error:abort.signal.aborted?undefined:cause instanceof Error?cause.message:'回答连接失败，请重试。'}));
   if(mounted.current&&current===sequence.current&&!abort.signal.aborted&&cause instanceof ApiError&&cause.status===401)void study.logout(study.sessionToken);
  }finally{if(mounted.current&&current===sequence.current){controller.current=null;setBusy(false);void refresh();input.current?.focus();}}
 };
 const newChat=()=>{if(busy)return;sequence.current++;setExchanges([]);setText('');onClearContext();input.current?.focus();};
 if(!open)return null;
 return createPortal(<div className="ai-backdrop" onClick={onClose}><section className="ai-chat" ref={panel} role="dialog" aria-modal="true" aria-label="岐黄学习助手" onClick={event=>event.stopPropagation()} onKeyDown={event=>{
  if(event.key==='Escape'){event.stopPropagation();onClose();}
  if(event.key==='Tab'){const controls=[...panel.current!.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),a[href]')],first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
 }}><header className="ai-chat-header"><span className="ai-mark"><Sparkles size={21}/></span><div><small>ASK QIHUANG</small><h2>岐黄学习助手</h2></div><button title="新建对话" aria-label="新建对话" disabled={busy} onClick={newChat}><Plus size={19}/></button><button aria-label="关闭学习助手" onClick={onClose}><X size={20}/></button></header>
 {context&&<div className="ai-context"><BookOpen size={14}/><span>正在讨论：{context.title}</span><button aria-label="移除讨论主题" disabled={busy} onClick={onClearContext}><X size={14}/></button></div>}
 <div className="ai-conversation" ref={scroll}>
 {!study.user?<div className="ai-welcome"><MessageCircle size={32}/><h3>登录后，与岐黄一起学习。</h3><p>解释一个概念，读懂一段典籍，沿着知识之间的联系继续探索。</p><button className="primary" onClick={()=>{onClose();onNavigate('study');}}>前往登录</button></div>:study.user.mustChangePassword?<div className="ai-welcome"><p>请先修改临时密码，再使用学习助手。</p></div>:<>
 {!exchanges.length&&<div className="ai-welcome"><Sparkles size={29}/><h3>从一个问题，读懂一片知识。</h3><p>可以请我解释概念、比较本草，或陪你梳理经典中的学习线索。</p><div className="ai-prompts">{['阴阳应该怎样理解？','桂枝与肉桂有什么区别？','怎样开始阅读《黄帝内经》？'].map(question=><button key={question} disabled={!available} onClick={()=>{setText(question);input.current?.focus();}}>{question}<ArrowUp size={13}/></button>)}</div></div>}
 {statusError&&<div className="ai-notice" role="alert">{statusError}<button onClick={()=>void refresh()}>重试读取状态</button></div>}
 {status&&!status.enabled&&<div className="ai-notice">学习助手暂未开启，等待管理员完成模型设置。</div>}
 {status?.enabled&&!status.globalAvailable&&<div className="ai-notice">今日学习助手总额度已用完，请明天再来。</div>}
 {status?.enabled&&status.remaining===0&&<div className="ai-notice">今日提问额度已用完，北京时间零点重置。</div>}
 {exchanges.map(item=><div className="ai-exchange" key={item.id}><div className="ai-question">{item.question}</div><article className="ai-answer"><span className="ai-answer-label"><Sparkles size={13}/>岐黄</span>{item.answer?<MarkdownText text={item.answer}/>:<p>{item.state==='loading'?'正在查阅与思考…':item.state==='stopped'?'已停止生成。':'本次未生成回答。'}</p>}{item.state==='loading'&&<span className="ai-generating" role="status">{item.thinking&&!item.answer?'模型正在思考，尚未开始生成正文…':'正在生成回答…'}</span>}{item.state==='stopped'&&item.answer&&<small>回答已停止，以上为部分内容。</small>}{item.error&&<div className="ai-notice" role="alert">{item.error}</div>}{item.state==='error'&&<button className="ai-retry" disabled={busy||!available} onClick={()=>void send(item.question,item.id)}>重试回答</button>}{item.sources.length>0&&<div className="ai-sources"><small>参考站内资料 · 原典出处仍需核对</small>{item.sources.map(source=><button key={source.id} aria-label={'参考知识 '+source.title} onClick={()=>{onClose();onNavigate('knowledge/'+source.id);}}><BookOpen size={13}/><span>{source.title}<small>{source.source}</small></span></button>)}</div>}</article></div>)}
 </>}
 </div><form className="ai-composer" onSubmit={event=>{event.preventDefault();void send(text);}}><div className="ai-quota"><span>{study.user&&status?`今日剩余 ${status.remaining} / ${status.dailyLimit} 次`:'中医学习与文献理解'}</span><small>北京时间零点重置</small></div><div className="ai-input-wrap"><textarea ref={input} aria-label="向岐黄提问" placeholder={context?'围绕当前条目继续提问…':'写下你想了解的中医知识…'} rows={3} maxLength={3000} value={text} disabled={!available||busy} onChange={event=>setText(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send(text);}}}/>{busy?<button type="button" aria-label="停止生成" onClick={()=>controller.current?.abort()}><Square size={17}/></button>:<button type="submit" aria-label="发送提问" disabled={!available||!text.trim()}><ArrowUp size={20}/></button>}</div><p>AI 辅助学习，回答请结合资料核对。已生成内容的提问计入额度。</p></form></section></div>,document.body);
}
