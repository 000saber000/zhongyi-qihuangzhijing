import type {Express,Response} from 'express';
import type {Pool} from 'pg';
import {HttpError,invalid} from '../errors';
import {owner,loadConfig,saveConfig,publicConfig,decrypt,keyBytes,type AiOptions} from './config';
import {retrieve,prompt} from './retrieval';
import {reserve,release,usage} from './quota';
import {callModel,streamModel,type Message} from './provider';
function input(body:any):{messages:Message[];contextId?:string}{
 if(!body||!Array.isArray(body.messages)||body.messages.length<1||body.messages.length>8)throw invalid();
 let size=0;for(let i=0;i<body.messages.length;i++){
  const m=body.messages[i];if(!m||m.role!==(i%2===body.messages.length%2?'assistant':'user')||typeof m.content!=='string'||!m.content.trim()||m.content.length>3000)throw invalid();size+=m.content.length;
 }
 if(size>12000||body.messages.at(-1).role!=='user')throw invalid();
 if(body.contextId!==undefined&&(typeof body.contextId!=='string'||!/^[a-z][a-z0-9-]{2,79}$/.test(body.contextId)))throw invalid();
 return {messages:body.messages.map((m:Message)=>({role:m.role,content:m.content})),contextId:body.contextId};
}
function event(res:Response,type:string,data:unknown){if(!res.destroyed)res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);}
export function installAiRoutes(app:Express,pool:Pool,options:AiOptions={}){
 const settings={...options,encryptionKey:options.encryptionKey??process.env.AI_CONFIG_ENCRYPTION_KEY},fetcher=options.fetch??globalThis.fetch;
 app.use('/api/admin/ai',(_req,res,next)=>{if(!owner(res.locals.user))throw new HttpError(403,'AI_OWNER_REQUIRED','只有指定管理员可以管理模型接入。');next();});
 app.get('/api/admin/ai',async(_req,res)=>res.json(publicConfig(await loadConfig(pool),settings)));
 app.put('/api/admin/ai',async(req,res)=>res.json(await saveConfig(pool,req.body,res.locals.user,settings)));
 app.post('/api/admin/ai/test',async(_req,res)=>{
  const user=res.locals.user,key='ai-test:'+user.id;
  const limited=await pool.query("INSERT INTO auth_rate_limits(ip_hash) VALUES($1) ON CONFLICT(ip_hash) DO UPDATE SET attempts=CASE WHEN auth_rate_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts+1 END,window_start=CASE WHEN auth_rate_limits.window_start<now()-interval '15 minutes' THEN now() ELSE auth_rate_limits.window_start END RETURNING attempts",[key]);
  if(limited.rows[0].attempts>10)throw new HttpError(429,'RATE_LIMITED','连接测试过于频繁，请稍后再试。');
  const config=await loadConfig(pool),apiKey=decrypt(config,settings),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  const close=()=>{if(!res.writableEnded)controller.abort();};res.on('close',close);
  try{const response=await callModel(config,apiKey,[{role:'user',content:'请回答：连接成功。'}],controller.signal,fetcher,false);const data:any=await response.json();if(typeof data.choices?.[0]?.message?.content!=='string'||!data.choices[0].message.content.trim())throw new Error('No text');
   await pool.query("INSERT INTO admin_audit(actor_id,actor_username,target_id,target_username,action) VALUES($1,$2,$1,$2,'ai_connection_test')",[user.id,user.username]);res.json({ok:true});
  }catch{throw new HttpError(502,'AI_TEST_FAILED','连接测试失败，请检查厂商、模型名称与密钥后重试。');}finally{clearTimeout(timer);res.off('close',close);}
 });
 app.get('/api/ai/status',async(_req,res)=>{
  const config=await loadConfig(pool),quota=await usage(pool,res.locals.user.id,config);
  res.json({enabled:config.enabled&&Boolean(config.encryptedKey)&&Boolean(keyBytes(settings.encryptionKey)),...quota,resetTimezone:'Asia/Shanghai'});
 });
 app.post('/api/ai/chat',async(req,res)=>{
  const {messages,contextId}=input(req.body),config=await loadConfig(pool);
  if(!config.enabled)throw new HttpError(503,'AI_DISABLED','学习助手暂未开启，请稍后再来。');
  const apiKey=decrypt(config,settings),entries=await retrieve(pool,messages.at(-1)!.content,contextId);
  const reservation=await reserve(pool,res.locals.user.id,config),controller=new AbortController();let emitted=false;
  const timer=setTimeout(()=>controller.abort(),90000),close=()=>{if(!res.writableEnded)controller.abort();};res.on('close',close);
  try{
   if(res.destroyed){controller.abort();return;}
   res.setHeader('Content-Type','text/event-stream; charset=utf-8');res.setHeader('Cache-Control','no-store, no-transform');res.setHeader('X-Accel-Buffering','no');res.flushHeaders();
   event(res,'meta',{sources:entries.map(({id,title,source,confidence})=>({id,title,source,confidence})),remaining:reservation.remaining});
   await streamModel(config,apiKey,[{role:'system',content:prompt(entries)},...messages],controller.signal,async text=>{if(res.destroyed||controller.signal.aborted)throw new Error('Disconnected');emitted=true;event(res,'delta',{text});},fetcher);
   event(res,'done',{ok:true});
  }catch{if(!res.destroyed)event(res,'error',{message:controller.signal.aborted?'回答生成超时，请稍后重试。':'模型服务暂时不可用，请重试或联系管理员检查配置。'});}
  finally{clearTimeout(timer);res.off('close',close);try{await release(pool,reservation,!emitted);}finally{res.end();}}
 });
}
