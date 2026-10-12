import {HttpError} from '../errors';
import {providers,type ModelConfig} from './config';
export type Message={role:'user'|'assistant';content:string};
const failure=()=>new HttpError(502,'AI_PROVIDER_ERROR','模型服务暂时不可用，请稍后重试或联系管理员检查配置。');
export async function callModel(config:ModelConfig,key:string,messages:{role:string;content:string}[],signal:AbortSignal,fetcher:typeof fetch,stream=true){
 const response=await fetcher(providers[config.provider]+'/chat/completions',{method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model:config.model,messages,stream,max_tokens:stream?config.maxTokens:16})});
 if(!response.ok){await response.body?.cancel();throw failure();}return response;
}
export async function streamModel(config:ModelConfig,key:string,messages:{role:string;content:string}[],signal:AbortSignal,onDelta:(text:string)=>Promise<void>,fetcher:typeof fetch){
 const response=await callModel(config,key,messages,signal,fetcher),reader=response.body?.getReader();if(!reader)throw failure();
 const decoder=new TextDecoder();let buffer='',finished=false,total=0;
 const frame=async(raw:string)=>{
  const data=raw.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(!data)return;
  if(data==='[DONE]'){finished=true;return;}
  let event:any;try{event=JSON.parse(data);}catch{throw failure();}
  if(event.error)throw failure();const delta=event.choices?.[0]?.delta?.content;
  if(typeof delta==='string'&&delta){total+=delta.length;if(total>24000)throw failure();await onDelta(delta);}
 };
 try{
  while(!finished){
   if(signal.aborted)throw failure();const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});
   let match:RegExpExecArray|null;
   while((match=/\r?\n\r?\n/.exec(buffer))){if(match.index>65536)throw failure();const raw=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);await frame(raw);if(finished)break;}
   if(buffer.length>65536)throw failure();
   if(done){if(buffer.trim())await frame(buffer);if(!finished)throw failure();break;}
  }
  if(total===0)throw failure();
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
