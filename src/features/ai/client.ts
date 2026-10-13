import {ApiError} from '../../lib/api';
import type {ChatEvent,Message} from './types';
export async function streamChat(token:string,messages:Message[],contextId:string|undefined,signal:AbortSignal,onEvent:(event:ChatEvent)=>void){
 const base=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');if(!base)throw new Error('云端服务尚未配置。');
 const controller=new AbortController(),cancel=()=>controller.abort();let timedOut=false;
 if(signal.aborted)cancel();else signal.addEventListener('abort',cancel,{once:true});
 const timeout=setTimeout(()=>{timedOut=true;cancel();},110000);
 try{
 const response=await fetch(base+'/api/ai/chat',{method:'POST',signal:controller.signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({messages,contextId})});
 if(!response.ok){const data=await response.json().catch(()=>null);throw new ApiError(response.status,data?.error?.code??'AI_FAILED',data?.error?.message??'学习助手暂时不可用，请重试。');}
 if(!response.headers.get('Content-Type')?.includes('text/event-stream'))throw new Error('回答格式错误，请重试。');
 const reader=response.body?.getReader();if(!reader)throw new Error('无法读取回答，请重试。');
 const decoder=new TextDecoder();let buffer='',completed=false;
 const frame=(raw:string)=>{
  let type='';const lines:string[]=[];for(const line of raw.split(/\r?\n/)){if(line.startsWith('event:'))type=line.slice(6).trim();if(line.startsWith('data:'))lines.push(line.slice(5).trimStart());}
  if(!lines.length)return;const data=JSON.parse(lines.join('\n'));
  if(type==='error')throw new Error(typeof data.message==='string'?data.message:'回答生成失败，请重试。');
  if(type==='meta'&&Array.isArray(data.sources))onEvent({type:'meta',sources:data.sources,remaining:data.remaining});
  if(type==='delta'&&typeof data.text==='string')onEvent({type:'delta',text:data.text});
  if(type==='progress'&&data.stage==='thinking')onEvent({type:'progress',stage:'thinking'});
  if(type==='done'){completed=true;onEvent({type:'done'});}
 };
 try{
  while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let match:RegExpExecArray|null;
   while((match=/\r?\n\r?\n/.exec(buffer))){if(match.index>65536)throw new Error('回答格式错误，请重试。');frame(buffer.slice(0,match.index));buffer=buffer.slice(match.index+match[0].length);}
   if(buffer.length>65536)throw new Error('回答格式错误，请重试。');
   if(done){if(buffer.trim())frame(buffer);break;}
  }
  if(!completed)throw new Error('回答连接中断，请重试。');
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 }catch(error){
  if(timedOut&&!signal.aborted)throw new Error('回答连接超时，请稍后重试。');
  throw error;
 }finally{clearTimeout(timeout);signal.removeEventListener('abort',cancel);}
}
