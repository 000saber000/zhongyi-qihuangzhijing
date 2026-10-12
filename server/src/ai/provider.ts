import {HttpError} from '../errors';
import {providers,type ModelConfig} from './config';
export type Message={role:'user'|'assistant';content:string};
export class ProviderError extends HttpError {
 constructor(code:string,message:string,public upstreamStatus?:number){super(502,code,message);}
}
const failure=()=>new ProviderError('AI_PROVIDER_ERROR','模型返回的回答不完整，请重试。');
export const emptyAnswer=(limited=false)=>new ProviderError(limited?'AI_OUTPUT_LIMIT':'AI_EMPTY_ANSWER',limited?'模型已达到单次输出上限，尚未生成正文。请管理员使用非思考模型，或调整单次回答 token 上限后重试。':'模型未返回回答正文，请重试或请管理员检查模型名称。');
function rejected(status:number){
 const errors:Record<number,[string,string]>={
  400:['AI_PROVIDER_REQUEST','模型拒绝了请求，请管理员检查模型名称和参数设置。'],
  401:['AI_PROVIDER_AUTH','模型 API 密钥无效或已失效，请管理员更新密钥。'],
  402:['AI_PROVIDER_BALANCE','模型账户余额不足，请管理员在模型厂商平台检查余额。'],
  403:['AI_PROVIDER_PERMISSION','模型账户没有调用权限，请管理员检查模型权限。'],
  404:['AI_PROVIDER_MODEL','模型名称不存在或已下线，请管理员核对厂商当前支持的模型名称。'],
  429:['AI_PROVIDER_RATE_LIMIT','模型厂商暂时限制了请求频率，请稍后重试。']
 };
 const [code,message]=errors[status]??['AI_PROVIDER_UNAVAILABLE','模型厂商服务暂时不可用，请稍后重试。'];return new ProviderError(code,message,status);
}
export async function callModel(config:ModelConfig,key:string,messages:{role:string;content:string}[],signal:AbortSignal,fetcher:typeof fetch,stream=true){
 let response:Response;
 try{response=await fetcher(providers[config.provider]+'/chat/completions',{method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model:config.model,messages,stream,max_tokens:stream?config.maxTokens:16,...(config.provider==='deepseek'&&config.model!=='deepseek-reasoner'?{thinking:{type:'disabled'}}:{})})});}
 catch(error){if(signal.aborted)throw error;throw new ProviderError('AI_PROVIDER_NETWORK','无法连接模型厂商，请稍后重试。');}
 if(!response.ok){await response.body?.cancel().catch(()=>{});throw rejected(response.status);}return response;
}
export async function streamModel(config:ModelConfig,key:string,messages:{role:string;content:string}[],signal:AbortSignal,onDelta:(text:string)=>Promise<void>,fetcher:typeof fetch,onThinking?:()=>Promise<void>){
 const response=await callModel(config,key,messages,signal,fetcher),reader=response.body?.getReader();if(!reader)throw failure();
 const decoder=new TextDecoder();let buffer='',finished=false,total=0,thinking=false,limited=false;
 const frame=async(raw:string)=>{
  const data=raw.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(!data)return;
  if(data==='[DONE]'){finished=true;return;}
  let event:any;try{event=JSON.parse(data);}catch{throw failure();}
  if(event.error)throw failure();const choice=event.choices?.[0],delta=choice?.delta?.content;
  if(choice?.finish_reason==='length')limited=true;
  if(!thinking&&typeof choice?.delta?.reasoning_content==='string'&&choice.delta.reasoning_content){thinking=true;await onThinking?.();}
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
  if(total===0)throw emptyAnswer(limited);
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
