import {test} from 'node:test';
import assert from 'node:assert/strict';
import {callModel,streamModel} from '../src/ai/provider';
import {HttpError} from '../src/errors';
import type {ModelConfig} from '../src/ai/config';
const config:ModelConfig={provider:'deepseek',model:'deepseek-flash',enabled:true,dailyLimit:10,globalDailyLimit:200,maxTokens:1024,version:1,encryptedKey:null};
const signal=new AbortController().signal,messages=[{role:'user',content:'解释阴阳'}];
test('DeepSeek direct answers explicitly disable default thinking within the saved budget',async()=>{
 let body:any;
 await callModel(config,'fake-key',messages,signal,async(_url,init)=>{body=JSON.parse(String(init?.body));return new Response();});
 assert.deepEqual(body.thinking,{type:'disabled'});assert.equal(body.max_tokens,1024);assert.equal(body.model,'deepseek-flash');
});
test('reasoner reports progress once without exposing reasoning, then streams the final answer',async()=>{
 const output:string[]=[],progress:string[]=[];
 const response='data: {"choices":[{"delta":{"reasoning_content":"private thought"}}]}\n\ndata: {"choices":[{"delta":{"reasoning_content":"more private thought"}}]}\n\ndata: {"choices":[{"delta":{"content":"阴阳相互依存"}}]}\n\ndata: [DONE]\n\n';
 await streamModel({...config,model:'deepseek-reasoner'},'fake-key',messages,signal,async text=>{output.push(text);},async()=>new Response(response),async()=>{progress.push('thinking');});
 assert.deepEqual(output,['阴阳相互依存']);assert.deepEqual(progress,['thinking']);
});
test('reasoning exhausted token budget gets an actionable error rather than an empty answer',async()=>{
 const response='data: {"choices":[{"delta":{"reasoning_content":"private"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n';
 await assert.rejects(streamModel(config,'fake-key',messages,signal,async()=>{},async()=>new Response(response)),error=>error instanceof HttpError&&error.code==='AI_OUTPUT_LIMIT'&&!error.message.includes('private'));
});
test('vendor failures are classified without exposing vendor error bodies or triggering website logout',async()=>{
 for(const [status,code] of [[401,'AI_PROVIDER_AUTH'],[402,'AI_PROVIDER_BALANCE'],[404,'AI_PROVIDER_MODEL'],[429,'AI_PROVIDER_RATE_LIMIT'],[400,'AI_PROVIDER_REQUEST']] as const){
  await assert.rejects(callModel(config,'fake-key',messages,signal,async()=>new Response('private-key private-prompt',{status})),error=>error instanceof HttpError&&error.status===502&&error.code===code&&!error.message.includes('private'));
 }
});
