import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import type {Server} from 'node:http';
import {createApp} from '../src/app';
import {migrate} from '../src/db';

const connectionString=process.env.TEST_DATABASE_URL;
if(!connectionString)throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL database');
const schema='contributions_'+randomUUID().replaceAll('-',''),control=new Pool({connectionString});
const pool=new Pool({connectionString,options:'-c search_path='+schema});
let server:Server,base:string,serial=0;
const password='contribution password 123';
before(async()=>{await control.query('CREATE SCHEMA '+schema);await migrate(pool);await migrate(pool);server=createApp(pool,['http://localhost:5173']).listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+(server.address() as {port:number}).port;});
after(async()=>{if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();await control.query('DROP SCHEMA '+schema+' CASCADE');await control.end();});
beforeEach(async()=>{await pool.query('DELETE FROM auth_rate_limits');});
async function request(path:string,method='GET',body?:unknown,token?:string){const res=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,data:res.status===204?null:await res.json() as any};}
async function account(admin=false){const res=await request('/api/auth/register','POST',{username:'Contributor_'+(++serial),password});assert.equal(res.status,201);if(admin)await pool.query("UPDATE users SET role='admin' WHERE id=$1",[res.data.user.id]);return res.data;}
async function classic(admin:any){const id='classic-contribution-'+(++serial),content={id,type:'经',title:'贡献测试',subtitle:'',summary:'原简介',body:'原文第一段。\n原文第二段。',source:'原出处',tags:[],relations:[],confidence:'待核对',keyPoints:['原要点']};const created=await request('/api/admin/classics','POST',{content},admin.token);assert.equal(created.status,201);assert.equal((await request('/api/admin/classics/'+id+'/publish','POST',{version:created.data.version},admin.token)).status,200);return content;}
async function suggest(member:any,item:any,changes={body:'修订后的中文正文。'}){return request('/api/classics/'+item.id+'/suggestions','POST',{base:{body:item.body,summary:item.summary,source:item.source,keyPoints:item.keyPoints},changes,reason:'根据校订本第一篇修订'},member.token);}

test('members comment on published classics, guests read, and administrators hide comments',async()=>{
 const admin=await account(true),member=await account(),item=await classic(admin),path='/api/classics/'+item.id+'/comments';
 assert.equal((await request(path,'POST',{body:'学习心得'})).status,401);
 const created=await request(path,'POST',{body:'<script>这是纯文本</script>\n我的心得'},member.token);assert.equal(created.status,201);
 const listed=await request(path);assert.equal(listed.status,200);assert.equal(listed.data.total,1);assert.equal(listed.data.comments[0].author,member.user.username);assert.equal(listed.data.comments[0].body,'<script>这是纯文本</script>\n我的心得');
 assert.equal((await request('/api/admin/comments/'+created.data.id,'DELETE',undefined,member.token)).status,403);
 assert.equal((await request('/api/admin/comments/'+created.data.id,'DELETE',undefined,admin.token)).status,204);
 assert.equal((await request(path)).data.total,0);
});
test('rejects invalid comments, missing and unpublished entries',async()=>{
 const admin=await account(true),member=await account(),item=await classic(admin);
 for(const body of ['', '  ', '字'.repeat(2001),7])assert.equal((await request('/api/classics/'+item.id+'/comments','POST',{body},member.token)).status,400);
 for(const id of ['classic-missing','invalid!']){assert.ok([400,404].includes((await request('/api/classics/'+id+'/comments')).status));assert.ok([400,404].includes((await request('/api/classics/'+id+'/comments','POST',{body:'心得'},member.token)).status));}
 await pool.query('UPDATE knowledge_entries SET published=NULL WHERE id=$1',[item.id]);assert.equal((await request('/api/classics/'+item.id+'/comments')).status,404);
});
test('suggestions stay private, acceptance changes draft only and publishing stays explicit',async()=>{
 const admin=await account(true),member=await account(),other=await account(),item=await classic(admin);
 const added=await suggest(member,item);assert.equal(added.status,201);assert.equal(added.data.status,'pending');
 assert.equal((await request('/api/suggestions/mine','GET',undefined,other.token)).data.total,0);
 assert.equal((await request('/api/admin/suggestions','GET',undefined,member.token)).status,403);
 const queue=await request('/api/admin/suggestions','GET',undefined,admin.token);assert.ok(queue.data.pendingCount>0);assert.equal(queue.data.suggestions.find((s:any)=>s.id===added.data.id).reason,'根据校订本第一篇修订');
 const path='/api/admin/suggestions/'+added.data.id+'/review';assert.equal((await request(path,'POST',{action:'merge'},member.token)).status,403);
 const merged=await request(path,'POST',{action:'merge',note:'校对后采纳'},admin.token);assert.equal(merged.status,200);assert.equal(merged.data.status,'merged');
 const entry=(await request('/api/admin/classics','GET',undefined,admin.token)).data.entries.find((e:any)=>e.draft.id===item.id);assert.equal(entry.draft.body,'修订后的中文正文。');assert.equal(entry.published.body,item.body);
 assert.equal((await request(path,'POST',{action:'merge'},admin.token)).status,409);
 const mine=(await request('/api/suggestions/mine','GET',undefined,member.token)).data.suggestions.find((s:any)=>s.id===added.data.id);assert.equal(mine.status,'merged');assert.equal(mine.reviewNote,'校对后采纳');
 assert.equal((await request('/api/admin/classics/'+item.id+'/publish','POST',{version:entry.version},admin.token)).status,200);
 assert.equal((await request('/api/knowledge')).data.items.find((i:any)=>i.id===item.id).body,'修订后的中文正文。');
});
test('rejection records a reason without changing the draft',async()=>{
 const admin=await account(true),member=await account(),item=await classic(admin),s=await suggest(member,item);
 const reviewed=await request('/api/admin/suggestions/'+s.data.id+'/review','POST',{action:'reject',note:'请补充版本出处'},admin.token);assert.equal(reviewed.status,200);assert.equal(reviewed.data.status,'rejected');
 const row=(await pool.query('SELECT draft,published FROM knowledge_entries WHERE id=$1',[item.id])).rows[0];assert.deepEqual(row.draft,row.published);
 const mine=(await request('/api/suggestions/mine','GET',undefined,member.token)).data.suggestions.find((i:any)=>i.id===s.data.id);assert.equal(mine.reviewNote,'请补充版本出处');
});
test('conflicting suggestions cannot overwrite an administrator draft; unrelated fields are preserved',async()=>{
 const admin=await account(true),member=await account(),item=await classic(admin),s=await suggest(member,item);
 await pool.query("UPDATE knowledge_entries SET draft=jsonb_set(draft,'{source}',to_jsonb('管理员新出处'::text)),version=version+1 WHERE id=$1",[item.id]);
 assert.equal((await request('/api/admin/suggestions/'+s.data.id+'/review','POST',{action:'merge'},admin.token)).status,200);
 const row=(await pool.query('SELECT draft,published FROM knowledge_entries WHERE id=$1',[item.id])).rows[0];assert.equal(row.draft.source,'管理员新出处');assert.equal(row.draft.body,'修订后的中文正文。');assert.equal(row.published.body,item.body);
 const conflict=await suggest(member,item);assert.equal(conflict.status,201);
 const response=await request('/api/admin/suggestions/'+conflict.data.id+'/review','POST',{action:'merge'},admin.token);assert.equal(response.status,409);assert.equal(response.data.error.code,'SUGGESTION_CONFLICT');
 assert.equal((await pool.query('SELECT status FROM classic_suggestions WHERE id=$1',[conflict.data.id])).rows[0].status,'pending');
});
test('concurrent acceptance processes a suggestion exactly once',async()=>{
 const admin=await account(true),member=await account(),item=await classic(admin),s=await suggest(member,item),path='/api/admin/suggestions/'+s.data.id+'/review';
 const responses=await Promise.all([request(path,'POST',{action:'merge'},admin.token),request(path,'POST',{action:'merge'},admin.token)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 assert.equal((await pool.query('SELECT version FROM knowledge_entries WHERE id=$1',[item.id])).rows[0].version,3);
});
test('suggestions validate allowed fields and snapshots and block expired, disabled or password-reset accounts',async()=>{
 const admin=await account(true),member=await account(),item=await classic(admin),path='/api/classics/'+item.id+'/suggestions',base={body:item.body};
 for(const payload of [{base,changes:{},reason:'理由'},{base,changes:{title:'改名'},reason:'理由'},{base,changes:{body:'修改'},reason:''},{base:{body:'伪造原文'},changes:{body:'修改'},reason:'理由'},{base,changes:{body:7},reason:'理由'}])assert.ok([400,409].includes((await request(path,'POST',payload,member.token)).status));
 assert.equal((await request(path,'POST',{base,changes:{body:'修改'},reason:'理由'})).status,401);
 await pool.query('UPDATE users SET disabled=true WHERE id=$1',[member.user.id]);assert.equal((await suggest(member,item)).status,401);
 await pool.query('UPDATE users SET disabled=false,must_change_password=true WHERE id=$1',[member.user.id]);assert.equal((await suggest(member,item)).data.error.code,'PASSWORD_CHANGE_REQUIRED');
 await pool.query('UPDATE users SET must_change_password=false WHERE id=$1',[member.user.id]);await pool.query('DELETE FROM sessions WHERE user_id=$1',[member.user.id]);assert.equal((await suggest(member,item)).status,401);
});
test('comment pagination and per-account limits are enforced, with author snapshots after account deletion',async()=>{
 const admin=await account(true),member=await account(),item=await classic(admin),path='/api/classics/'+item.id+'/comments';
 for(let n=0;n<10;n++)assert.equal((await request(path,'POST',{body:'心得 '+n},member.token)).status,201);
 assert.equal((await request(path,'POST',{body:'第十一条'},member.token)).status,429);
 assert.equal((await request(path+'?page=0')).status,400);
 await pool.query('DELETE FROM users WHERE id=$1',[member.user.id]);const list=await request(path);assert.equal(list.data.total,10);assert.ok(list.data.comments.every((c:any)=>c.author===member.user.username));
});
test('suggestion limits and list filters are bounded',async()=>{
 const admin=await account(true),member=await account(),item=await classic(admin);
 for(let n=0;n<5;n++)assert.equal((await suggest(member,item,{body:'第'+n+'个建议'})).status,201);
 assert.equal((await suggest(member,item)).status,429);
 assert.equal((await request('/api/admin/suggestions?status=invalid','GET',undefined,admin.token)).status,400);
 assert.equal((await request('/api/suggestions/mine?page=0','GET',undefined,member.token)).status,400);
});
test('accepts a maximum-length Chinese body and its original snapshot',async()=>{
 const admin=await account(true),member=await account(),item=await classic(admin),longBody='经'.repeat(50000);
 const updated=await request('/api/admin/classics/'+item.id,'PUT',{version:2,content:{...item,body:longBody}},admin.token);assert.equal(updated.status,200);
 assert.equal((await request('/api/admin/classics/'+item.id+'/publish','POST',{version:updated.data.version},admin.token)).status,200);
 const submitted=await suggest(member,{...item,body:longBody},{body:'典'+longBody.slice(1)});assert.equal(submitted.status,201);assert.equal(submitted.data.changes.body.length,50000);
});
test('every knowledge category supports comments, suggested revisions, draft review and manual publishing',async()=>{
 const admin=await account(true),catalog=(await request('/api/knowledge')).data.items;
 const types=[...new Set(catalog.map((item:any)=>item.type))];assert.equal(types.length,9);
 for(const type of types){
  const member=await account(),item=catalog.find((i:any)=>i.type===type),path='/api/classics/'+item.id;
  assert.equal((await request(path+'/comments','POST',{body:'分类 '+type+' 的学习心得'},member.token)).status,201);
  assert.equal((await request(path+'/comments')).data.comments[0].body,'分类 '+type+' 的学习心得');
  const summary=item.summary+'\n补充核对说明。';
  const added=await request(path+'/suggestions','POST',{base:{summary:item.summary},changes:{summary},reason:'补充文献核对'},member.token);assert.equal(added.status,201);
  assert.equal((await request('/api/admin/suggestions/'+added.data.id+'/review','POST',{action:'merge'},admin.token)).status,200);
  const entry=(await request('/api/admin/classics','GET',undefined,admin.token)).data.entries.find((e:any)=>e.draft.id===item.id);assert.ok(entry);assert.equal(entry.draft.summary,summary);assert.equal(entry.published.summary,item.summary);assert.equal(entry.draft.type,type);
  assert.equal((await request('/api/admin/classics/'+item.id+'/publish','POST',{version:entry.version},admin.token)).status,200);
  assert.equal((await request('/api/knowledge')).data.items.find((i:any)=>i.id===item.id).summary,summary);
 }
});
test('administrators can create all categories while existing entry types stay immutable',async()=>{
 const admin=await account(true),original=await classic(admin);
 for(const type of ['理','药','方','经络','穴','法','人','案']){
  const content={...original,id:'knowledge-added-'+(++serial),type};const created=await request('/api/admin/classics','POST',{content},admin.token);assert.equal(created.status,201);
  assert.equal((await request('/api/admin/classics/'+content.id,'PUT',{version:1,content:{...content,summary:'管理员编辑后的简介'}},admin.token)).status,200);
 }
 assert.equal((await request('/api/admin/classics/'+original.id,'PUT',{version:2,content:{...original,type:'药'}},admin.token)).status,400);
 for(const type of ['全部','未知'])assert.equal((await request('/api/admin/classics','POST',{content:{...original,id:'invalid-type-'+(++serial),type}},admin.token)).status,400);
});
