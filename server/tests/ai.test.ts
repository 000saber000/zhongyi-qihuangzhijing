import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {Pool} from 'pg';
import type {Server} from 'node:http';
import {createApp} from '../src/app';
import {migrate} from '../src/db';
const connectionString=process.env.TEST_DATABASE_URL;
if(!connectionString)throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL database');
const schema='ai_test_'+randomUUID().replaceAll('-','');
const control=new Pool({connectionString}),pool=new Pool({connectionString,options:'-c search_path='+schema});
const encryptionKey=randomBytes(32).toString('base64'),secret='sk-test-only-never-a-real-secret';
let server:Server,base:string,owner:any,member:any,otherAdmin:any;
let upstream:(url:string,init:RequestInit)=>Promise<Response>;
let calls:{url:string;body:any;auth:string|null}[]=[];
function okStream(){return new Response('data: {"choices":[{"delta":{"content":"阴阳是一种关系。"}}]}\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});}
async function request(path:string,method='GET',body?:unknown,token?:string){const response=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json() as any};}
async function account(username:string,admin=false){const result=await request('/api/auth/register','POST',{username,password:'test password 123'});assert.equal(result.status,201);if(admin)await pool.query("UPDATE users SET role='admin' WHERE id=$1",[result.data.user.id]);return result.data;}
async function configure(changes:Record<string,unknown>={}){const current=await request('/api/admin/ai','GET',undefined,owner.token);return request('/api/admin/ai','PUT',{version:current.data.version,provider:'deepseek',model:'deepseek-chat',enabled:true,dailyLimit:10,globalDailyLimit:200,maxTokens:1024,apiKey:secret,...changes},owner.token);}
async function chat(body:unknown={messages:[{role:'user',content:'解释阴阳'}],contextId:'theory-yinyang'},token=member.token){const response=await fetch(base+'/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});return {status:response.status,text:await response.text()};}
before(async()=>{
 await control.query('CREATE SCHEMA '+schema);await migrate(pool);
 server=createApp(pool,['http://localhost:5173'],{ai:{encryptionKey,fetch:async(url:any,init:any)=>{calls.push({url:String(url),body:JSON.parse(init.body),auth:new Headers(init.headers).get('Authorization')});return upstream(String(url),init);}}}).listen(0,'127.0.0.1');
 await new Promise<void>(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+(server.address() as any).port;
 owner=await account('aidejiasinuo',true);member=await account('Learner');otherAdmin=await account('AnotherAdmin',true);
});
after(async()=>{if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();await control.query('DROP SCHEMA '+schema+' CASCADE');await control.end();});
beforeEach(async()=>{calls=[];upstream=async()=>okStream();await pool.query('DELETE FROM auth_rate_limits');await pool.query('DELETE FROM ai_activity');await pool.query('DELETE FROM ai_usage');await pool.query('DELETE FROM ai_settings');});
test('only the named database administrator manages model settings; guests and other admins cannot',async()=>{
 assert.equal((await request('/api/admin/ai')).status,401);
 for(const token of [member.token,otherAdmin.token])for(const method of ['GET','PUT'])assert.equal((await request('/api/admin/ai',method,method==='PUT'?{}:undefined,token)).status,403);
 const view=await request('/api/admin/ai','GET',undefined,owner.token);assert.equal(view.status,200);assert.equal(view.data.hasKey,false);assert.equal(view.data.encryptionReady,true);
 await pool.query("UPDATE users SET role='user' WHERE id=$1",[owner.user.id]);try{assert.equal((await request('/api/admin/ai','GET',undefined,owner.token)).status,403);}finally{await pool.query("UPDATE users SET role='admin' WHERE id=$1",[owner.user.id]);}
});
test('keys are encrypted, never returned, retained on blank input; stale writes and provider switches are rejected',async()=>{
 const saved=await configure();assert.equal(saved.status,200);assert.equal(saved.data.hasKey,true);assert.ok(!JSON.stringify(saved.data).includes(secret));
 const rows=await pool.query('SELECT * FROM ai_settings');assert.ok(!JSON.stringify(rows.rows).includes(secret));
 assert.equal((await request('/api/admin/ai','PUT',{...saved.data,version:0,apiKey:secret},owner.token)).status,409);
 const retained=await configure({apiKey:''});assert.equal(retained.status,200);assert.equal(retained.data.hasKey,true);
 assert.equal((await configure({provider:'qwen',apiKey:''})).status,400);
 for(const changes of [{provider:'http://localhost'},{dailyLimit:0},{maxTokens:2049},{model:'bad\nmodel'},{apiKey:'bad\r\nkey'}])assert.equal((await configure(changes)).status,400);
});
test('unconfigured and invalid chat requests do not call model or spend quota',async()=>{
 assert.equal((await chat()).status,503);await configure();
 for(const body of [{messages:[]},{messages:[{role:'system',content:'pretend admin'}]},{messages:[{role:'assistant',content:'hi'}]},{messages:[{role:'user',content:'字'.repeat(3001)}]},{messages:[{role:'user',content:'hi'}],contextId:'private-draft'}])assert.ok([400,404].includes((await chat(body)).status));
 assert.equal(calls.length,0);assert.equal((await request('/api/ai/status','GET',undefined,member.token)).data.remaining,10);
});
test('streaming includes actual published references and server context, with bounded model call and daily status',async()=>{
 await configure();const result=await chat();assert.equal(result.status,200);assert.ok(result.text.includes('event: meta'));assert.ok(result.text.includes('theory-yinyang'));assert.ok(result.text.includes('阴阳是一种关系'));assert.ok(result.text.includes('event: done'));
 assert.equal(calls[0].url,'https://api.deepseek.com/v1/chat/completions');assert.equal(calls[0].auth,'Bearer '+secret);assert.equal(calls[0].body.stream,true);assert.equal(calls[0].body.max_tokens,1024);assert.match(calls[0].body.messages[0].content,/阴阳/);
 assert.equal((await request('/api/ai/status','GET',undefined,member.token)).data.remaining,9);
});
test('unpublished content is excluded; published updates are retrieved without rebuilding',async()=>{
 await configure();await pool.query("UPDATE knowledge_entries SET draft=jsonb_set(draft,'{body}',to_jsonb('PRIVATE-DRAFT-SECRET'::text)),published=jsonb_set(published,'{summary}',to_jsonb('PUBLISHED-CONTENT-UPDATED'::text)) WHERE id='theory-yinyang'");
 try{await chat();const prompt=calls[0].body.messages[0].content;assert.ok(prompt.includes('PUBLISHED-CONTENT-UPDATED'));assert.ok(!prompt.includes('PRIVATE-DRAFT-SECRET'));}finally{await pool.query("UPDATE knowledge_entries SET published=jsonb_set(published,'{summary}',draft->'summary') WHERE id='theory-yinyang'");}
});
test('provider errors never expose upstream secrets and refund before any text; partial output spends quota',async()=>{
 await configure();upstream=async()=>new Response('leaked '+secret,{status:401});const failed=await chat();assert.ok(!failed.text.includes(secret));assert.equal((await request('/api/ai/status','GET',undefined,member.token)).data.remaining,10);
 upstream=async()=>new Response('data: {"choices":[{"delta":{"content":"部分回答"}}]}\n\n');const partial=await chat();assert.ok(partial.text.includes('event: error'));assert.equal((await request('/api/ai/status','GET',undefined,member.token)).data.remaining,9);
});
test('personal and global caps are atomic across concurrent accounts',async()=>{
 await configure({dailyLimit:1,globalDailyLimit:1});const results=await Promise.all([chat(),chat(undefined,otherAdmin.token)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,429]);assert.equal(calls.length,1);
 assert.equal((await chat()).status,429);
});
test('same account cannot overlap generation; cancellation aborts upstream and releases lease',async()=>{
 await configure();let entered!:()=>void;const ready=new Promise<void>(resolve=>entered=resolve);let aborted=false;
 upstream=async(_url,init)=>{entered();return new Promise((_resolve,reject)=>init.signal!.addEventListener('abort',()=>{aborted=true;reject(new Error('aborted'));},{once:true}));};
 const controller=new AbortController();const first=fetch(base+'/api/ai/chat',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+member.token},body:JSON.stringify({messages:[{role:'user',content:'阴阳'}]})}).catch(()=>undefined);
 await ready;const second=await chat();assert.equal(second.status,429);controller.abort();await first;
 for(let i=0;i<40&&!aborted;i++)await new Promise(resolve=>setTimeout(resolve,25));assert.equal(aborted,true);
 for(let i=0;i<40;i++){if(!(await pool.query('SELECT * FROM ai_activity')).rowCount)break;await new Promise(resolve=>setTimeout(resolve,25));}
 assert.equal((await pool.query('SELECT * FROM ai_activity')).rowCount,0);
});
test('connection tests are owner-only, bounded, sanitized and do not spend learner quota',async()=>{
 await configure();assert.equal((await request('/api/admin/ai/test','POST',{},member.token)).status,403);
 upstream=async()=>new Response(JSON.stringify({choices:[{message:{content:'ok'}}]}),{headers:{'Content-Type':'application/json'}});
 const result=await request('/api/admin/ai/test','POST',{},owner.token);assert.equal(result.status,200);assert.equal(result.data.ok,true);assert.equal(calls[0].body.max_tokens,16);assert.equal(calls[0].body.stream,false);
 assert.equal((await request('/api/ai/status','GET',undefined,member.token)).data.remaining,10);
});
test('SSE decoding preserves Chinese split across individual bytes and CRLF event boundaries',async()=>{
 await configure();const bytes=new TextEncoder().encode('data: {"choices":[{"delta":{"content":"阴阳相互依存"}}]}\r\n\r\ndata: [DONE]\r\n\r\n');
 upstream=async()=>new Response(new ReadableStream({start(controller){for(const byte of bytes)controller.enqueue(Uint8Array.of(byte));controller.close();}}));
 const result=await chat();assert.ok(result.text.includes('阴阳相互依存'));assert.ok(result.text.includes('event: done'));
});
test('daily quota uses Beijing date and ignores the previous day; disabled and reset users cannot chat',async()=>{
 await configure({dailyLimit:1});await pool.query("INSERT INTO ai_usage(day,scope,used) VALUES((now() AT TIME ZONE 'Asia/Shanghai')::date-1,$1,1)",[member.user.id]);
 assert.equal((await request('/api/ai/status','GET',undefined,member.token)).data.remaining,1);
 await pool.query('UPDATE users SET disabled=true WHERE id=$1',[member.user.id]);assert.equal((await chat()).status,401);
 await pool.query('UPDATE users SET disabled=false,must_change_password=true WHERE id=$1',[member.user.id]);assert.equal((await chat()).status,403);
 await pool.query('UPDATE users SET must_change_password=false WHERE id=$1',[member.user.id]);assert.equal((await chat()).status,200);
});
test('missing encryption setup fails closed without disclosing settings or spending quota',async()=>{
 const other=createApp(pool,['http://localhost:5173'],{ai:{encryptionKey:'invalid'}}).listen(0,'127.0.0.1');await new Promise<void>(resolve=>other.once('listening',resolve));
 const url='http://127.0.0.1:'+(other.address() as any).port;
 try{await configure();const headers={Authorization:'Bearer '+owner.token,'Content-Type':'application/json'};
  const response=await fetch(url+'/api/admin/ai',{headers});assert.equal((await response.json() as any).encryptionReady,false);
  const update=await fetch(url+'/api/admin/ai',{method:'PUT',headers,body:JSON.stringify({provider:'deepseek',model:'deepseek-chat',enabled:true,dailyLimit:10,globalDailyLimit:200,maxTokens:1024,version:1,apiKey:secret})});assert.equal(update.status,503);
  const chatResponse=await fetch(url+'/api/ai/chat',{method:'POST',headers,body:JSON.stringify({messages:[{role:'user',content:'阴阳'}]})});assert.equal(chatResponse.status,503);assert.equal(calls.length,0);
 }finally{await new Promise<void>(resolve=>other.close(()=>resolve()));}
});
test('valid small SSE frames work when transport coalesces more than 64KB',async()=>{
 await configure({maxTokens:2048});const body=('data: {"choices":[{"delta":{"content":"字"}}]}\n\n').repeat(1600)+'data: [DONE]\n\n';upstream=async()=>new Response(body);
 const result=await chat();assert.ok(result.text.includes('event: done'));assert.equal((result.text.match(/event: delta/g)??[]).length,1600);
});
test('owner can disable independently of model fields and encryption, retain key, and re-enable later',async()=>{
 const saved=await configure({dailyLimit:7});assert.equal(saved.status,200);
 const stopped=await request('/api/admin/ai/disable','POST',{version:saved.data.version},owner.token);assert.equal(stopped.status,200);assert.equal(stopped.data.enabled,false);assert.equal(stopped.data.hasKey,true);assert.equal(stopped.data.model,'deepseek-chat');assert.equal(stopped.data.dailyLimit,7);
 assert.equal((await chat()).status,503);assert.equal(calls.length,0);
 const resumed=await request('/api/admin/ai','PUT',{...stopped.data,enabled:true,apiKey:''},owner.token);assert.equal(resumed.status,200);assert.equal((await chat()).status,200);
 const other=createApp(pool,['http://localhost:5173'],{ai:{encryptionKey:'invalid'}}).listen(0,'127.0.0.1');await new Promise<void>(resolve=>other.once('listening',resolve));
 try{const response=await fetch('http://127.0.0.1:'+(other.address() as any).port+'/api/admin/ai/disable',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+owner.token},body:JSON.stringify({version:resumed.data.version})});assert.equal(response.status,200);assert.equal((await response.json() as any).enabled,false);}finally{await new Promise<void>(resolve=>other.close(()=>resolve()));}
});
test('one-click enable restores saved settings without spending quota or calling the vendor',async()=>{
 const saved=await configure({dailyLimit:7});await chat();
 const stopped=await request('/api/admin/ai/disable','POST',{version:saved.data.version},owner.token);
 const before=(await pool.query('SELECT * FROM ai_settings')).rows[0];calls=[];
 const enabled=await request('/api/admin/ai/enable','POST',{version:stopped.data.version},owner.token);
 assert.equal(enabled.status,200);assert.equal(enabled.data.enabled,true);assert.equal(enabled.data.version,stopped.data.version+1);assert.equal(enabled.data.hasKey,true);
 const after=(await pool.query('SELECT * FROM ai_settings')).rows[0];
 for(const field of ['provider','model','encrypted_key','daily_limit','global_daily_limit','max_tokens'])assert.equal(after[field],before[field]);
 assert.equal(calls.length,0);assert.equal((await request('/api/ai/status','GET',undefined,member.token)).data.remaining,6);assert.equal((await chat()).status,200);
});
test('one-click enable enforces owner, version and valid saved configuration',async()=>{
 assert.equal((await request('/api/admin/ai/enable','POST',{version:0})).status,401);
 for(const token of [member.token,otherAdmin.token])assert.equal((await request('/api/admin/ai/enable','POST',{version:0},token)).status,403);
 const saved=await configure();const stopped=await request('/api/admin/ai/disable','POST',{version:saved.data.version},owner.token);
 assert.equal((await request('/api/admin/ai/enable','POST',{version:saved.data.version},owner.token)).status,409);
 for(const version of [-1,'1',undefined])assert.equal((await request('/api/admin/ai/enable','POST',{version},owner.token)).status,400);
 const other=createApp(pool,['http://localhost:5173'],{ai:{encryptionKey:'invalid'}}).listen(0,'127.0.0.1');await new Promise<void>(resolve=>other.once('listening',resolve));
 try{const response=await fetch('http://127.0.0.1:'+(other.address() as any).port+'/api/admin/ai/enable',{method:'POST',headers:{Authorization:'Bearer '+owner.token,'Content-Type':'application/json'},body:JSON.stringify({version:stopped.data.version})});assert.equal(response.status,503);}finally{await new Promise<void>(resolve=>other.close(()=>resolve()));}
 assert.equal((await request('/api/admin/ai','GET',undefined,owner.token)).data.enabled,false);
 const cleared=await request('/api/admin/ai','DELETE',{version:stopped.data.version},owner.token);assert.equal((await request('/api/admin/ai/enable','POST',{version:cleared.data.version},owner.token)).status,400);
 assert.equal((await request('/api/admin/ai','GET',undefined,owner.token)).data.enabled,false);assert.equal(calls.length,0);
});
test('clear removes encrypted key and model, preserves quotas and usage, and prevents stale restoration',async()=>{
 const saved=await configure({dailyLimit:7});await chat();
 const cleared=await request('/api/admin/ai','DELETE',{version:saved.data.version},owner.token);assert.equal(cleared.status,200);assert.equal(cleared.data.enabled,false);assert.equal(cleared.data.hasKey,false);assert.equal(cleared.data.model,'');assert.equal(cleared.data.dailyLimit,7);
 const row=(await pool.query('SELECT * FROM ai_settings')).rows[0];assert.equal(row.encrypted_key,null);assert.equal(row.model,'');assert.equal(row.version,saved.data.version+1);
 assert.equal((await request('/api/ai/status','GET',undefined,member.token)).data.remaining,6);assert.equal((await chat()).status,503);
 assert.equal((await request('/api/admin/ai','PUT',{...saved.data,apiKey:secret},owner.token)).status,409);
 assert.equal((await configure()).status,200);assert.equal((await chat()).status,200);
});
test('disable and clear reject guests, other admins, invalid and conflicting versions',async()=>{
 const saved=await configure();
 for(const [path,method] of [['/api/admin/ai/disable','POST'],['/api/admin/ai','DELETE']]){
  assert.equal((await request(path,method,{version:saved.data.version})).status,401);
  for(const token of [member.token,otherAdmin.token])assert.equal((await request(path,method,{version:saved.data.version},token)).status,403);
  assert.equal((await request(path,method,{version:0},owner.token)).status,409);
  for(const version of [-1,'1',undefined])assert.equal((await request(path,method,{version},owner.token)).status,400);
 }
 assert.equal((await request('/api/admin/ai','GET',undefined,owner.token)).data.enabled,true);
});
test('disable aborts active generation before any text, refunds quota, and blocks new upstream calls',async()=>{
 const saved=await configure();let aborted=false,entered!:()=>void;const ready=new Promise<void>(resolve=>entered=resolve);
 upstream=async(_url,init)=>{entered();return new Promise((_resolve,reject)=>init.signal!.addEventListener('abort',()=>{aborted=true;reject(new Error('aborted'));},{once:true}));};
 const pending=chat();await ready;const stopped=await request('/api/admin/ai/disable','POST',{version:saved.data.version},owner.token);assert.equal(stopped.status,200);const result=await pending;assert.equal(aborted,true);assert.ok(result.text.includes('学习助手已关闭'));
 assert.equal((await request('/api/ai/status','GET',undefined,member.token)).data.remaining,10);assert.equal((await chat()).status,503);assert.equal(calls.length,1);
});
test('clear aborts active partial output and preserves already spent quota',async()=>{
 const saved=await configure();let aborted=false;
 upstream=async(_url,init)=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"已生成内容"}}]}\n\n'));init.signal!.addEventListener('abort',()=>{aborted=true;controller.error(new Error('aborted'));},{once:true});}}));
 const response=await fetch(base+'/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+member.token},body:JSON.stringify({messages:[{role:'user',content:'阴阳'}]})});const reader=response.body!.getReader();let text='';const decoder=new TextDecoder();
 while(!text.includes('已生成内容')){const chunk=await reader.read();assert.equal(chunk.done,false);text+=decoder.decode(chunk.value);}
 assert.equal((await request('/api/admin/ai','DELETE',{version:saved.data.version},owner.token)).status,200);
 while(true){const chunk=await reader.read();if(chunk.done)break;text+=decoder.decode(chunk.value);}
 assert.equal(aborted,true);assert.ok(text.includes('学习助手已关闭'));assert.equal((await request('/api/ai/status','GET',undefined,member.token)).data.remaining,9);
});
test('disable and clear from another API instance stop pending streams, including immediate re-enable',async()=>{
 const other=createApp(pool,['http://localhost:5173'],{ai:{encryptionKey}}).listen(0,'127.0.0.1');await new Promise<void>(resolve=>other.once('listening',resolve));const otherUrl='http://127.0.0.1:'+(other.address() as any).port;
 try{for(const [path,method,resume] of [['/api/admin/ai/disable','POST',false],['/api/admin/ai','DELETE',false],['/api/admin/ai/disable','POST',true]] as const){
  const saved=await configure();let entered!:()=>void,aborted=false;const ready=new Promise<void>(resolve=>entered=resolve);
  upstream=async(_url,init)=>{entered();return new Promise((_resolve,reject)=>init.signal!.addEventListener('abort',()=>{aborted=true;reject(new Error('aborted'));},{once:true}));};
  const controller=new AbortController();const pending=fetch(base+'/api/ai/chat',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+member.token},body:JSON.stringify({messages:[{role:'user',content:'阴阳'}]})}).then(response=>response.text()).catch(()=>'');
  await ready;const response=await fetch(otherUrl+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+owner.token},body:JSON.stringify({version:saved.data.version})});assert.equal(response.status,200);await response.json();
  if(resume)assert.equal((await configure()).status,200);
  let deadline:ReturnType<typeof setTimeout>|undefined;
  const finished=await Promise.race([pending.then(()=>true),new Promise<boolean>(resolve=>{deadline=setTimeout(()=>resolve(false),3000);})]);clearTimeout(deadline);
  if(!finished)controller.abort();await pending;assert.equal(finished,true,'generation must observe shutdown on the other instance');assert.equal(aborted,true);
  assert.equal((await request('/api/ai/status','GET',undefined,member.token)).data.remaining,10);
 }}finally{await new Promise<void>(resolve=>other.close(()=>resolve()));}
});
test('configuration read failure after quota admission returns JSON error and refunds before response',async()=>{
 await configure();const original=pool.query.bind(pool);let reads=0;
 (pool as any).query=async(...args:any[])=>{if(args[0]==='SELECT * FROM ai_settings WHERE id=1'&&++reads===2)throw new Error('private database failure');return (original as any)(...args);};
 try{const response=await fetch(base+'/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+member.token},body:JSON.stringify({messages:[{role:'user',content:'阴阳'}]})});assert.equal(response.status,503);assert.match(response.headers.get('Content-Type')??'',/application\/json/);assert.ok(!(await response.text()).includes('private database failure'));assert.equal((await request('/api/ai/status','GET',undefined,member.token)).data.remaining,10);assert.equal(calls.length,0);}finally{(pool as any).query=original;}
});

test('saved DeepSeek configuration reports vendor errors in chat and test, refunds and keeps settings',async()=>{
 const saved=await configure({model:'deepseek-flash'});
 for(const [status,code,message] of [[401,'AI_PROVIDER_AUTH','密钥'],[402,'AI_PROVIDER_BALANCE','余额'],[404,'AI_PROVIDER_MODEL','模型名称'],[429,'AI_PROVIDER_RATE_LIMIT','请求频率']] as const){
  upstream=async()=>new Response('private vendor body '+secret,{status});
  const result=await chat();assert.equal(result.status,200);assert.ok(result.text.includes(code));assert.ok(result.text.includes(message));assert.ok(!result.text.includes(secret));assert.ok(!result.text.includes('private vendor body'));assert.ok(!result.text.includes('event: done'));
  const connection=await request('/api/admin/ai/test','POST',{},owner.token);assert.equal(connection.status,502);assert.equal(connection.data.error.code,code);assert.ok(!JSON.stringify(connection.data).includes(secret));
  assert.equal((await request('/api/ai/status','GET',undefined,member.token)).data.remaining,10);
 }
 const current=await request('/api/admin/ai','GET',undefined,owner.token);assert.deepEqual(current.data,saved.data);
});
test('reasoning-only token limit forwards progress and error but no private thought and refunds',async()=>{
 await configure({model:'deepseek-reasoner'});
 upstream=async()=>new Response('data: {"choices":[{"delta":{"reasoning_content":"PRIVATE-REASONING"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n');
 const result=await chat();assert.ok(result.text.includes('event: progress'));assert.ok(result.text.includes('AI_OUTPUT_LIMIT'));assert.ok(!result.text.includes('PRIVATE-REASONING'));assert.ok(!result.text.includes('event: delta'));assert.ok(!result.text.includes('event: done'));
 assert.equal((await request('/api/ai/status','GET',undefined,member.token)).data.remaining,10);
});
