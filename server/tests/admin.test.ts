import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import type {Server} from 'node:http';
import {createApp} from '../src/app';
import * as db from '../src/db';

const connectionString=process.env.TEST_DATABASE_URL;
if(!connectionString)throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL database');
const schema='admin_test_'+randomUUID().replaceAll('-','');
const control=new Pool({connectionString});
const pool=new Pool({connectionString,options:'-c search_path='+schema,application_name:schema});
const password='admin test password';
let server:Server,base:string,serial=0,owner:any;
before(async()=>{await control.query('CREATE SCHEMA '+schema);await db.migrate(pool);server=createApp(pool,['http://localhost:5173']).listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+(server.address() as {port:number}).port;});
after(async()=>{if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();await control.query('DROP SCHEMA '+schema+' CASCADE');await control.end();});
beforeEach(async()=>{await pool.query('DELETE FROM auth_rate_limits');});
async function request(path:string,method='GET',body?:unknown,token?:string){const res=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,data:res.status===204?null:await res.json() as any};}
async function register(prefix='Member'){const res=await request('/api/auth/register','POST',{username:prefix+'_'+(++serial),password});assert.equal(res.status,201);return res.data;}
async function bootstrap(username:string){assert.equal(typeof (db as any).bootstrapAdmin,'function','Existing-account administrator bootstrap must exist');return (db as any).bootstrapAdmin(pool,username);}
async function administrator(){if(!owner){owner=await register('Owner');await bootstrap(owner.user.username);owner=(await request('/api/auth/login','POST',{username:owner.user.username,password})).data;}return owner;}

test('normal registration ignores forged administrative fields',async()=>{
 const res=await request('/api/auth/register','POST',{username:'Forged_'+(++serial),password,role:'admin',disabled:false,mustChangePassword:false});
 assert.equal(res.status,201);assert.equal(res.data.user.role,'user');assert.equal(res.data.user.mustChangePassword,false);
 assert.equal((await request('/api/admin/users','GET',undefined,res.data.token)).status,403);
});
test('bootstrap promotes only an existing selected account and is idempotent',async()=>{
 const admin=await administrator();await bootstrap(admin.user.username.toUpperCase());await db.migrate(pool);await db.migrate(pool);
 assert.equal((await request('/api/auth/me','GET',undefined,admin.token)).data.user.role,'admin');
 await assert.rejects(()=>bootstrap('Future_owner'));
 const future=await request('/api/auth/register','POST',{username:'Future_owner',password});assert.equal(future.data.user.role,'user');
 await assert.rejects(()=>bootstrap('Future_owner'));
 assert.equal((await pool.query("SELECT count(*)::int AS count FROM users WHERE role='admin'")).rows[0].count,1);
});
test('administrator routes reject guests, ordinary users and invalid target identifiers',async()=>{
 const member=await register(),admin=await administrator();
 for(const [path,method,body] of [['/api/admin/users','GET',undefined],['/api/admin/audit','GET',undefined],['/api/admin/users/'+member.user.id+'/status','PUT',{disabled:true}],['/api/admin/users/'+member.user.id+'/revoke-sessions','POST',undefined],['/api/admin/users/'+member.user.id+'/reset-password','POST',{adminPassword:password}],['/api/admin/users/'+member.user.id,'DELETE',{confirmUsername:member.user.username,adminPassword:password}]] as const){assert.equal((await request(path,method,body)).status,401);assert.equal((await request(path,method,body,member.token)).status,403);}
 assert.equal((await request('/api/admin/users/not-a-uuid/status','PUT',{disabled:true},admin.token)).status,400);
 assert.equal((await request('/api/admin/users/'+randomUUID()+'/status','PUT',{disabled:true},admin.token)).status,404);
});
test('lists bounded literal-substring account results and learning counts without credentials',async()=>{
 const admin=await administrator(),member=await register('Find'),decoy=await register('FindX');
 await request('/api/bookmarks/theory-yinyang','PUT',undefined,member.token);await request('/api/completions/foundation-0','PUT',undefined,member.token);
 const result=await request('/api/admin/users?q=FIND_','GET',undefined,admin.token);assert.equal(result.status,200);assert.equal(result.data.total,1);assert.equal(result.data.users[0].id,member.user.id);assert.notEqual(result.data.users[0].id,decoy.user.id);assert.equal(result.data.users[0].bookmarkCount,1);assert.equal(result.data.users[0].completedCount,1);assert.equal(result.data.users[0].activeSessions,1);assert.ok(result.data.users[0].createdAt);
 assert.deepEqual(Object.keys(result.data.users[0]).sort(),['id','username','role','disabled','mustChangePassword','createdAt','bookmarkCount','completedCount','activeSessions'].sort());
 for(let i=0;i<21;i++)await pool.query("INSERT INTO users(id,username_key,username,password_hash) SELECT $1,$2,$2,password_hash FROM users WHERE id=$3",[randomUUID(),'paged_'+i,member.user.id]);
 const first=(await request('/api/admin/users?q=Paged_','GET',undefined,admin.token)).data,second=(await request('/api/admin/users?q=Paged_&page=2','GET',undefined,admin.token)).data;
 assert.equal(first.total,21);assert.equal(first.users.length,20);assert.equal(second.users.length,1);assert.equal(first.pageSize,20);assert.ok(!first.users.some((u:any)=>u.id===second.users[0].id));
 for(const query of ['page=0','page=1.5','page=1000001','q='+('x'.repeat(33))])assert.equal((await request('/api/admin/users?'+query,'GET',undefined,admin.token)).status,400);
});
test('disabling revokes every session while restoring preserves learning data and requires a new login',async()=>{
 const admin=await administrator(),member=await register();await request('/api/bookmarks/theory-yinyang','PUT',undefined,member.token);
 const another=(await request('/api/auth/login','POST',{username:member.user.username,password})).data;
 assert.equal((await request('/api/admin/users/'+member.user.id+'/status','PUT',{disabled:true},admin.token)).status,204);
 assert.equal((await request('/api/admin/users/'+member.user.id+'/status','PUT',{disabled:true},admin.token)).status,204);
 for(const token of [member.token,another.token])assert.equal((await request('/api/study','GET',undefined,token)).status,401);
 assert.equal((await request('/api/auth/login','POST',{username:member.user.username,password})).status,401);
 assert.equal((await request('/api/admin/users/'+member.user.id+'/status','PUT',{disabled:false},admin.token)).status,204);
 assert.equal((await request('/api/study','GET',undefined,member.token)).status,401);
 const active=(await request('/api/auth/login','POST',{username:member.user.username,password})).data;assert.deepEqual((await request('/api/study','GET',undefined,active.token)).data.bookmarks,['theory-yinyang']);
});
test('forced logout removes all sessions but permits a later valid login',async()=>{
 const admin=await administrator(),member=await register(),another=(await request('/api/auth/login','POST',{username:member.user.username,password})).data;
 assert.equal((await request('/api/admin/users/'+member.user.id+'/revoke-sessions','POST',undefined,admin.token)).status,204);
 for(const token of [member.token,another.token])assert.equal((await request('/api/auth/me','GET',undefined,token)).status,401);
 assert.equal((await request('/api/auth/login','POST',{username:member.user.username,password})).status,200);
});
test('password reset requires admin reauthentication, revokes sessions and enforces a replacement password',async()=>{
 const admin=await administrator(),member=await register();await request('/api/completions/foundation-0','PUT',undefined,member.token);
 const path='/api/admin/users/'+member.user.id+'/reset-password';assert.equal((await request(path,'POST',{adminPassword:'incorrect password'},admin.token)).status,403);
 assert.equal((await request('/api/auth/me','GET',undefined,admin.token)).status,200);
 const reset=await request(path,'POST',{adminPassword:password},admin.token);assert.equal(reset.status,200);const temporary=reset.data.temporaryPassword;assert.match(temporary,/^[A-Za-z0-9_-]{24}$/);
 assert.equal((await request('/api/auth/me','GET',undefined,member.token)).status,401);assert.equal((await request('/api/auth/login','POST',{username:member.user.username,password})).status,401);
 const pending=(await request('/api/auth/login','POST',{username:member.user.username,password:temporary})).data;assert.equal(pending.user.mustChangePassword,true);
 for(const [path,method,body] of [['/api/study','GET',undefined],['/api/bookmarks/theory-yinyang','PUT',undefined],['/api/study/import','POST',{bookmarks:[],completed:[]}],['/api/admin/users','GET',undefined]] as const)assert.equal((await request(path,method,body,pending.token)).data.error.code,'PASSWORD_CHANGE_REQUIRED');
 assert.equal((await request('/api/auth/password','POST',{currentPassword:'incorrect password',newPassword:'new member password'},pending.token)).status,400);
 assert.equal((await request('/api/auth/password','POST',{currentPassword:temporary,newPassword:temporary},pending.token)).status,400);
 const changed=await request('/api/auth/password','POST',{currentPassword:temporary,newPassword:'new member password'},pending.token);assert.equal(changed.status,200);assert.equal(changed.data.user.mustChangePassword,false);
 assert.equal((await request('/api/auth/me','GET',undefined,pending.token)).status,401);assert.deepEqual((await request('/api/study','GET',undefined,changed.data.token)).data.completed,['foundation-0']);
 assert.equal((await request('/api/auth/login','POST',{username:member.user.username,password:'new member password'})).status,200);
 const audit=await request('/api/admin/audit','GET',undefined,admin.token);assert.ok(audit.data.actions.some((a:any)=>a.action==='reset_password'&&a.targetUsername===member.user.username));
 for(const secret of [password,temporary,'new member password','scrypt$'])assert.ok(!JSON.stringify(audit.data).includes(secret));
});
test('administrator accounts cannot be disabled, revoked, reset or deleted',async()=>{
 const admin=await administrator(),id=admin.user.id;
 for(const [path,method,body] of [['/api/admin/users/'+id+'/status','PUT',{disabled:true}],['/api/admin/users/'+id+'/revoke-sessions','POST',undefined],['/api/admin/users/'+id+'/reset-password','POST',{adminPassword:password}],['/api/admin/users/'+id,'DELETE',{confirmUsername:admin.user.username,adminPassword:password}]] as const)assert.equal((await request(path,method,body,admin.token)).data.error.code,'ADMIN_PROTECTED');
 assert.equal((await request('/api/auth/me','GET',undefined,admin.token)).status,200);
});
test('confirmed deletion cascades learning records and sessions but retains audit snapshots',async()=>{
 const admin=await administrator(),member=await register();await request('/api/bookmarks/theory-yinyang','PUT',undefined,member.token);await request('/api/completions/foundation-0','PUT',undefined,member.token);
 const path='/api/admin/users/'+member.user.id;
 assert.equal((await request(path,'DELETE',{confirmUsername:'wrong',adminPassword:password},admin.token)).status,400);
 assert.equal((await request(path,'DELETE',{confirmUsername:member.user.username,adminPassword:'incorrect password'},admin.token)).status,403);
 assert.equal((await request(path,'DELETE',{confirmUsername:member.user.username,adminPassword:password},admin.token)).status,204);
 for(const table of ['sessions','bookmarks','lesson_completions'])assert.equal((await pool.query('SELECT count(*)::int AS count FROM '+table+' WHERE user_id=$1',[member.user.id])).rows[0].count,0);
 assert.equal((await request('/api/auth/me','GET',undefined,member.token)).status,401);
 const audit=(await request('/api/admin/audit','GET',undefined,admin.token)).data.actions.find((a:any)=>a.action==='delete'&&a.targetUsername===member.user.username);assert.ok(audit);assert.equal(audit.targetId,null);
});
test('audit failure rolls deletion back together with sessions and records',async()=>{
 const admin=await administrator(),member=await register();await request('/api/bookmarks/theory-yinyang','PUT',undefined,member.token);
 await pool.query("ALTER TABLE admin_audit ADD CONSTRAINT simulate_audit_failure CHECK(action <> 'delete') NOT VALID");
 try{assert.equal((await request('/api/admin/users/'+member.user.id,'DELETE',{confirmUsername:member.user.username,adminPassword:password},admin.token)).status,503);assert.deepEqual((await request('/api/study','GET',undefined,member.token)).data.bookmarks,['theory-yinyang']);}finally{await pool.query('ALTER TABLE admin_audit DROP CONSTRAINT simulate_audit_failure');}
});
test('an old-password login queued behind reset cannot recreate a revoked session',async()=>{
 const admin=await administrator(),member=await register(),lock=await pool.connect();let reset:ReturnType<typeof request>|undefined,login:ReturnType<typeof request>|undefined;
 const blocked=async(pattern:string)=>{for(let i=0;i<100;i++){const rows=await control.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE $2",[schema,pattern]);if(rows.rows[0].count)return;await new Promise(resolve=>setTimeout(resolve,30));}assert.fail('Expected a transaction row-lock barrier: '+pattern);};
 try{await lock.query('BEGIN');await lock.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[member.user.id]);reset=request('/api/admin/users/'+member.user.id+'/reset-password','POST',{adminPassword:password},admin.token);await blocked('%WHERE id=$1 FOR UPDATE%');login=request('/api/auth/login','POST',{username:member.user.username,password});await blocked('%username_key=$1 FOR UPDATE%');}
 finally{await lock.query('COMMIT');lock.release();}
 assert.equal((await reset!).status,200);assert.equal((await login!).status,401);assert.equal((await pool.query('SELECT count(*)::int AS count FROM sessions WHERE user_id=$1',[member.user.id])).rows[0].count,0);
});
