import {test, before, after, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import type {Server} from 'node:http';
import {createApp} from '../src/app';
import {migrate} from '../src/db';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL database');
const admin = new Pool({connectionString});
const schema = 'test_' + randomUUID().replaceAll('-', '');
const pool = new Pool({connectionString, options: '-c search_path=' + schema});
let server: Server, base: string;
const origin = 'http://localhost:5173';
const password = 'test password 123';
let serial = 0;
before(async () => {
  await admin.query('CREATE SCHEMA ' + schema);
  await migrate(pool); await migrate(pool);
  server = createApp(pool, [origin]).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = 'http://127.0.0.1:' + (server.address() as {port:number}).port;
});
after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await pool.end();
  await admin.query('DROP SCHEMA ' + schema + ' CASCADE'); await admin.end();
});
beforeEach(async () => {await pool.query('DELETE FROM auth_rate_limits');});
async function request(path: string, method = 'GET', body?: unknown, token?: string, extra: Record<string,string> = {}) {
  const response = await fetch(base + path, {method, headers: {'Origin': origin, ...(body ? {'Content-Type':'application/json'} : {}), ...(token ? {'Authorization': 'Bearer ' + token} : {}), ...extra}, body: body ? JSON.stringify(body) : undefined});
  return {status: response.status, headers: response.headers, data: response.status === 204 ? null : await response.json() as any};
}
async function register() {
  const result = await request('/api/auth/register', 'POST', {username: 'Learner_' + (++serial), password});
  assert.equal(result.status, 201); return result.data;
}
const classicContent=(id:string)=>({id,type:'经',title:'测试典籍',subtitle:'典籍副标题',summary:'典籍简介',body:'第一段原文\n第二段原文',source:'校订本·第一篇',tags:['经典'],relations:['theory-yinyang'],confidence:'已核对整理本',keyPoints:['先阅读原文']});
async function editor(){
  const user=await register();
  await pool.query("UPDATE users SET role='admin' WHERE id=$1",[user.user.id]);
  return user;
}
test('public catalog returns published seeds without requiring a session',async()=>{
  const response=await request('/api/knowledge');
  assert.equal(response.status,200);
  assert.ok(response.data.items.some((item:any)=>item.id==='classic-huangdi'));
});
test('admin rights cannot be registered or forged and are checked again after revocation',async()=>{
  assert.equal((await request('/api/admin/classics')).status,401);
  const user=await request('/api/auth/register','POST',{username:'Forged_'+(++serial),password,isAdmin:true,is_admin:true});
  assert.equal(user.data.user.role,'user');
  assert.equal((await request('/api/admin/classics','GET',undefined,user.data.token)).status,403);
  assert.equal((await request('/api/admin/classics','POST',{content:classicContent('classic-forged')},user.data.token)).status,403);
  const adminUser=await editor();
  assert.equal((await request('/api/auth/me','GET',undefined,adminUser.token)).data.user.role,'admin');
  assert.equal((await request('/api/admin/classics','GET',undefined,adminUser.token)).status,200);
  await pool.query("UPDATE users SET role='user' WHERE id=$1",[adminUser.user.id]);
  assert.equal((await request('/api/admin/classics','GET',undefined,adminUser.token)).status,403);
});
test('drafts stay private, publishing persists, and published additions support bookmarks and import',async()=>{
  const user=await editor(),id='classic-added',content=classicContent(id);
  const created=await request('/api/admin/classics','POST',{content},user.token);
  assert.equal(created.status,201);assert.equal(created.data.version,1);assert.equal(created.data.published,null);
  assert.ok(!(await request('/api/knowledge')).data.items.some((item:any)=>item.id===id));
  assert.equal((await request('/api/bookmarks/'+id,'PUT',undefined,user.token)).status,400);
  const published=await request('/api/admin/classics/'+id+'/publish','POST',{version:1},user.token);
  assert.equal(published.status,200);assert.equal(published.data.version,2);
  assert.deepEqual((await request('/api/knowledge')).data.items.find((item:any)=>item.id===id),content);
  assert.equal((await request('/api/bookmarks/'+id,'PUT',undefined,user.token)).status,204);
  assert.equal((await request('/api/study/import','POST',{bookmarks:[id],completed:[]},user.token)).status,200);
  await migrate(pool);
  assert.deepEqual((await request('/api/knowledge')).data.items.find((item:any)=>item.id===id),content);
  const edited=await request('/api/admin/classics/'+id,'PUT',{version:2,content:{...content,title:'新的草稿标题'}},user.token);
  assert.equal(edited.status,200);
  assert.equal((await request('/api/knowledge')).data.items.find((item:any)=>item.id===id).title,content.title);
});
test('classic writes validate IDs, text, published relations and immutable type; stale versions conflict',async()=>{
  const user=await editor(),content=classicContent('classic-versions');
  assert.equal((await request('/api/admin/classics','POST',{content},user.token)).status,201);
  assert.equal((await request('/api/admin/classics','POST',{content},user.token)).status,409);
  for(const change of [{id:'../bad'},{type:'全部'},{title:' '},{body:'x'.repeat(50001)},{relations:['does-not-exist']},{relations:['classic-versions']},{tags:[1]}]){
    assert.equal((await request('/api/admin/classics','POST',{content:{...classicContent('classic-invalid-'+(++serial)),...change}},user.token)).status,400);
  }
  assert.equal((await request('/api/admin/classics/classic-versions','PUT',{version:1,content:{...content,title:'新标题'}},user.token)).status,200);
  assert.equal((await request('/api/admin/classics/classic-versions','PUT',{version:1,content},user.token)).status,409);
  assert.equal((await request('/api/admin/classics/classic-versions/publish','POST',{version:1},user.token)).status,409);
  assert.equal((await request('/api/admin/classics/classic-versions/publish','POST',{version:2},user.token)).status,200);
  assert.equal((await request('/api/admin/classics/classic-huangdi','PUT',{version:1,content:{...content,id:'changed-id'}},user.token)).status,400);
  assert.equal((await request('/api/admin/classics/herb-guizhi','PUT',{version:1,content:{...content,id:'herb-guizhi'}},user.token)).status,400);
});
test('registers, hashes credentials and tokens, and restores case-insensitive login', async () => {
  const user = await register();
  const rows = await pool.query('SELECT password_hash FROM users WHERE id=$1', [user.user.id]);
  assert.notEqual(rows.rows[0].password_hash, password);
  const sessions = await pool.query('SELECT token_hash, expires_at FROM sessions WHERE user_id=$1',[user.user.id]);
  assert.notEqual(sessions.rows[0].token_hash,user.token);
  assert.ok(new Date(sessions.rows[0].expires_at).getTime() > Date.now() + 6.9*86400000);
  assert.equal((await request('/api/auth/me','GET',undefined,user.token)).data.user.username,user.user.username);
  const login = await request('/api/auth/login','POST',{username:user.user.username.toUpperCase(),password});
  assert.equal(login.status,200); assert.equal(login.data.user.id,user.user.id);
  assert.equal((await request('/api/auth/register','POST',{username:user.user.username.toLowerCase(),password})).status,409);
});
test('rejects invalid credentials, malformed JSON, long or invalid usernames and passwords', async () => {
  const user = await register();
  const wrong = await request('/api/auth/login','POST',{username:user.user.username,password:'wrong password'});
  const unknown = await request('/api/auth/login','POST',{username:'nonexistent_user',password:'wrong password'});
  assert.equal(wrong.status,401); assert.deepEqual(wrong.data,unknown.data);
  for (const body of [{username:'ab',password},{username:'名字',password},{username:'ok_user',password:'short'},{username:'ok_user',password:'x'.repeat(129)}]) assert.equal((await request('/api/auth/register','POST',body)).status,400);
  const malformed = await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'});
  assert.equal(malformed.status,400); assert.ok(((await malformed.json()) as {error:{code:string}}).error.code);
});
test('requires identity and revokes or expires sessions', async () => {
  assert.equal((await request('/api/study')).status,401);
  const user = await register();
  assert.equal((await request('/api/auth/logout','POST',undefined,user.token)).status,204);
  assert.equal((await request('/api/study','GET',undefined,user.token)).status,401);
  const other=await register();
  await pool.query('UPDATE sessions SET expires_at=now()-interval \'1 second\' WHERE user_id=$1',[other.user.id]);
  assert.equal((await request('/api/auth/me','GET',undefined,other.token)).status,401);
});
test('isolates accounts and supports idempotent writes across devices', async () => {
  const a=await register(), b=await register();
  const second=await request('/api/auth/login','POST',{username:a.user.username,password});
  await Promise.all([request('/api/bookmarks/formula-guizhi','PUT',undefined,a.token),request('/api/bookmarks/theory-yinyang','PUT',undefined,second.data.token)]);
  assert.equal((await request('/api/bookmarks/formula-guizhi','PUT',undefined,a.token)).status,204);
  assert.equal((await request('/api/completions/foundation-0','PUT',undefined,a.token)).status,204);
  assert.deepEqual((await request('/api/study','GET',undefined,b.token)).data,{bookmarks:[],completed:[]});
  const study=(await request('/api/study','GET',undefined,second.data.token)).data;
  assert.deepEqual(new Set(study.bookmarks),new Set(['formula-guizhi','theory-yinyang'])); assert.deepEqual(study.completed,['foundation-0']);
  await request('/api/bookmarks/formula-guizhi','DELETE',undefined,a.token);
  assert.equal((await request('/api/bookmarks/formula-guizhi','DELETE',undefined,a.token)).status,204);
});
test('imports a union transactionally, rejects unknown IDs and oversized imports', async () => {
  const a=await register();
  const body={bookmarks:['theory-yinyang','theory-yinyang'],completed:['foundation-0']};
  assert.equal((await request('/api/study/import','POST',body,a.token)).status,200);
  assert.equal((await request('/api/study/import','POST',body,a.token)).status,200);
  assert.equal((await request('/api/study/import','POST',{bookmarks:['formula-guizhi'],completed:['wrong-0']},a.token)).status,400);
  const study=(await request('/api/study','GET',undefined,a.token)).data;
  assert.deepEqual(study, {bookmarks:['theory-yinyang'],completed:['foundation-0']});
  assert.equal((await request('/api/study/import','POST',{bookmarks:Array(501).fill('theory-yinyang'),completed:[]},a.token)).status,400);
  assert.equal((await request('/api/bookmarks/invalid','PUT',undefined,a.token)).status,400);
  assert.equal((await request('/api/completions/invalid-0','PUT',undefined,a.token)).status,400);
  await migrate(pool);
  assert.deepEqual((await request('/api/study','GET',undefined,a.token)).data,study);
});
test('enforces allowed origins without trusting forged forwarded IPs', async () => {
  const allowed=await request('/healthz'); assert.equal(allowed.status,200); assert.equal(allowed.headers.get('access-control-allow-origin'),origin);
  assert.equal((await request('/api/auth/register','POST',{username:'evil_user',password},undefined,{Origin:'https://evil.example'})).status,403);
  const preflight=await fetch(base+'/api/study',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Headers':'authorization'}});
  assert.equal(preflight.status,204);
});
test('limits authentication to 20 requests per IP per 15 minutes despite spoofed forwarding',async()=>{
  for(let i=0;i<25;i++) await request('/api/auth/login','POST',{username:'nonexistent_user',password},undefined,{'X-Forwarded-For':'203.0.113.'+i});
  assert.equal((await request('/api/auth/login','POST',{username:'nonexistent_user',password})).status,429);
});
test('returns safe 503 responses when the database is unavailable',async()=>{
  const broken=new Pool({connectionString:'postgres://invalid:invalid@127.0.0.1:1/invalid',connectionTimeoutMillis:100});
  const s=createApp(broken,[origin]).listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>s.once('listening',resolve));
  const response=await fetch('http://127.0.0.1:'+(s.address() as {port:number}).port+'/healthz');
  assert.equal(response.status,503); const data=await response.json() as {error:{code:string}};assert.equal(data.error.code,'UNAVAILABLE');assert.ok(!JSON.stringify(data).includes('postgres://'));
  await new Promise<void>(resolve=>s.close(()=>resolve()));await broken.end();
});
test('rolls back already inserted import rows when a later database write fails',async()=>{
  const user=await register();
  await pool.query("ALTER TABLE bookmarks ADD CONSTRAINT simulate_write_failure CHECK(knowledge_id <> 'formula-guizhi') NOT VALID");
  try{
    const response=await request('/api/study/import','POST',{bookmarks:['theory-yinyang','formula-guizhi'],completed:['foundation-0']},user.token);
    assert.equal(response.status,503);
    assert.deepEqual((await request('/api/study','GET',undefined,user.token)).data,{bookmarks:[],completed:[]});
  }finally{await pool.query('ALTER TABLE bookmarks DROP CONSTRAINT simulate_write_failure');}
});
test('one-hop production proxy limit uses the nearest appended IP, not a spoofed prefix',async()=>{
  const s=createApp(pool,[origin],{trustProxy:1}).listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>s.once('listening',resolve));
  const url='http://127.0.0.1:'+(s.address() as {port:number}).port+'/api/auth/login';
  try{
    let status=0;
    for(let i=0;i<21;i++){
      const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'198.51.100.'+i+', 203.0.113.1'},body:JSON.stringify({username:'nonexistent_user',password})});status=response.status;await response.json();
    }
    assert.equal(status,429);
  }finally{await new Promise<void>(resolve=>s.close(()=>resolve()));}
});
