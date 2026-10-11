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
