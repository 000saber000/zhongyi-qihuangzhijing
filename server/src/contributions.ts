import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import type {Express} from 'express';
import type {Pool,PoolClient} from 'pg';
import type {Knowledge} from '../../src/data/catalog';
import {transaction} from './db';
import {HttpError,invalid} from './errors';
import {chapterContent} from './chapters';

const fields=['summary','body','chapters','source','keyPoints'] as const;
type Field=typeof fields[number];
type Changes=Partial<Pick<Knowledge,Field>>;
const pageNumber=(value:unknown)=>{if(value===undefined)return 1;if(typeof value!=='string'||!/^[1-9]\d{0,5}$/.test(value))throw invalid();return Number(value);};
const id=(value:unknown)=>{if(typeof value!=='string'||!/^[a-z][a-z0-9-]{2,79}$/.test(value))throw invalid();return value;};
const uuid=(value:unknown)=>{if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw invalid();return value;};
const text=(value:unknown,max:number,required=true)=>{if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw invalid();return value.trim();};
const value=(item:Knowledge,field:Field)=>item[field]??(field==='keyPoints'||field==='chapters'?[]:'');
async function publishedKnowledge(db:Pool|PoolClient,classicId:string,lock=false){
 const result=await db.query('SELECT draft,published,version FROM knowledge_entries WHERE id=$1'+(lock?' FOR UPDATE':''),[classicId]);
 const row=result.rows[0];if(!row?.published)throw new HttpError(404,'NOT_FOUND','未找到已发布的知识。');
 return row as {draft:Knowledge;published:Knowledge;version:number};
}
async function limit(db:PoolClient,userId:string,table:'classic_comments'|'classic_suggestions',max:number){
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[userId]);
 const result=await db.query('SELECT count(*)::int AS count FROM '+table+" WHERE user_id=$1 AND created_at>now()-interval '15 minutes'",[userId]);
 if(result.rows[0].count>=max)throw new HttpError(429,'RATE_LIMITED','提交过于频繁，请在 15 分钟后再试。');
}
function edits(input:unknown):Changes{
 if(!input||typeof input!=='object'||Array.isArray(input))throw invalid();
 const data=input as Record<string,unknown>,keys=Object.keys(data);
 if(!keys.length||keys.some(key=>!fields.includes(key as Field)))throw invalid();
 const changes:Changes={};
 for(const key of keys as Field[]){
  if(key==='keyPoints'){
   const points=data[key];if(!Array.isArray(points)||points.length>20)throw invalid();
   changes.keyPoints=points.map(point=>text(point,1000));
  }else if(key==='chapters')changes.chapters=chapterContent(data[key]);
  else changes[key]=text(data[key],key==='body'?50000:key==='summary'?4000:1000,key!=='body');
 }
 return changes;
}
const suggestion=(row:any)=>({id:row.id,classicId:row.classic_id,title:row.title,author:row.author_username,base:row.base,changes:row.changes,reason:row.reason,status:row.status,createdAt:new Date(row.created_at).toISOString(),reviewedAt:row.reviewed_at?new Date(row.reviewed_at).toISOString():null,reviewNote:row.review_note,mergedVersion:row.merged_version});
const selectSuggestions="SELECT s.*,k.published->>'title' AS title FROM classic_suggestions s JOIN knowledge_entries k ON k.id=s.classic_id";

export function publicComments(app:Express,pool:Pool){
 app.get('/api/classics/:id/comments',async(req,res)=>{
  const classicId=id(req.params.id),page=pageNumber(req.query.page),pageSize=20;await publishedKnowledge(pool,classicId);
  const [count,rows]=await Promise.all([
   pool.query('SELECT count(*)::int AS total FROM classic_comments WHERE classic_id=$1 AND hidden_at IS NULL',[classicId]),
   pool.query('SELECT id,author_username AS author,body,created_at AS "createdAt" FROM classic_comments WHERE classic_id=$1 AND hidden_at IS NULL ORDER BY created_at DESC,id LIMIT $2 OFFSET $3',[classicId,pageSize,(page-1)*pageSize])
  ]);
  res.json({comments:rows.rows,total:count.rows[0].total,page,pageSize});
 });
}
export function contributionRoutes(app:Express,pool:Pool){
 app.post('/api/classics/:id/comments',async(req,res)=>{
  const classicId=id(req.params.id),body=text(req.body?.body,2000),actor=res.locals.user;
  const comment=await transaction(pool,async db=>{
   await limit(db,actor.id,'classic_comments',10);await publishedKnowledge(db,classicId);
   const result=await db.query('INSERT INTO classic_comments(id,classic_id,user_id,author_username,body) VALUES($1,$2,$3,$4,$5) RETURNING id,author_username AS author,body,created_at AS "createdAt"',[randomUUID(),classicId,actor.id,actor.username,body]);return result.rows[0];
  });res.status(201).json(comment);
 });
 app.post('/api/classics/:id/suggestions',async(req,res)=>{
  const classicId=id(req.params.id),reason=text(req.body?.reason,2000),changes=edits(req.body?.changes),inputBase=req.body?.base,actor=res.locals.user;
  if(!inputBase||typeof inputBase!=='object'||Array.isArray(inputBase))throw invalid();
  const created=await transaction(pool,async db=>{
   await limit(db,actor.id,'classic_suggestions',5);const current=await publishedKnowledge(db,classicId,true),base:Changes={};
   if('body' in changes&&current.published.chapters!==undefined)throw new HttpError(409,'STALE_CONTENT','该知识已按章节编排，请刷新后编辑章节正文。');
   for(const field of Object.keys(changes) as Field[]){
    const old=value(current.published,field);
    if(!isDeepStrictEqual(inputBase[field],old))throw new HttpError(409,'STALE_CONTENT','知识已更新，请刷新正文后重新提交建议。');
    if(isDeepStrictEqual(changes[field],old))delete changes[field];else Object.assign(base,{[field]:old});
   }
   if(!Object.keys(changes).length)throw new HttpError(400,'NO_CHANGES','请修改至少一项内容，再提交建议。');
   const result=await db.query('INSERT INTO classic_suggestions(id,classic_id,user_id,author_username,base,changes,reason) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[randomUUID(),classicId,actor.id,actor.username,JSON.stringify(base),JSON.stringify(changes),reason]);
   return suggestion({...result.rows[0],title:current.published.title});
  });res.status(201).json(created);
 });
 app.get('/api/suggestions/mine',async(req,res)=>{
  const page=pageNumber(req.query.page),pageSize=10;
  const [count,rows]=await Promise.all([pool.query('SELECT count(*)::int AS total FROM classic_suggestions WHERE user_id=$1',[res.locals.user.id]),pool.query(selectSuggestions+' WHERE s.user_id=$1 ORDER BY s.created_at DESC,s.id LIMIT $2 OFFSET $3',[res.locals.user.id,pageSize,(page-1)*pageSize])]);
  res.json({suggestions:rows.rows.map(suggestion),total:count.rows[0].total,page,pageSize});
 });
 app.get('/api/admin/suggestions',async(req,res)=>{
  const status=req.query.status??'pending',page=pageNumber(req.query.page),pageSize=10;
  if(typeof status!=='string'||!['pending','merged','rejected','all'].includes(status))throw invalid();
  const [count,pending,rows]=await Promise.all([pool.query("SELECT count(*)::int AS total FROM classic_suggestions WHERE $1='all' OR status=$1",[status]),pool.query("SELECT count(*)::int AS count FROM classic_suggestions WHERE status='pending'"),pool.query(selectSuggestions+" WHERE $1='all' OR s.status=$1 ORDER BY s.created_at DESC,s.id LIMIT $2 OFFSET $3",[status,pageSize,(page-1)*pageSize])]);
  res.json({suggestions:rows.rows.map(suggestion),total:count.rows[0].total,pendingCount:pending.rows[0].count,page,pageSize});
 });
 app.post('/api/admin/suggestions/:id/review',async(req,res)=>{
  const suggestionId=uuid(req.params.id),action=req.body?.action,note=text(req.body?.note??'',2000,false),actor=res.locals.user;
  if(action!=='merge'&&action!=='reject')throw invalid();
  const reviewed=await transaction(pool,async db=>{
   const found=await db.query('SELECT * FROM classic_suggestions WHERE id=$1 FOR UPDATE',[suggestionId]),s=found.rows[0];
   if(!s)throw new HttpError(404,'NOT_FOUND','未找到这条修改建议。');
   if(s.status!=='pending')throw new HttpError(409,'ALREADY_REVIEWED','这条建议已处理，请刷新列表。');
   let mergedVersion:number|null=null;
   if(action==='merge'){
    const current=await publishedKnowledge(db,s.classic_id,true);
    if('body' in s.changes&&current.draft.chapters!==undefined)throw new HttpError(409,'SUGGESTION_CONFLICT','草稿已按章节编排，请将这条旧版正文建议手动整理到对应章节。');
    for(const field of Object.keys(s.changes) as Field[])if(!isDeepStrictEqual(value(current.draft,field),s.base[field]))throw new HttpError(409,'SUGGESTION_CONFLICT','草稿中相同内容已修改，未合并此建议。请核对最新草稿，手动调整或拒绝这条建议。');
    const next={...current.draft,...s.changes};mergedVersion=current.version+1;
    await db.query('UPDATE knowledge_entries SET draft=$2,version=version+1,updated_by=$3,updated_at=now() WHERE id=$1',[s.classic_id,JSON.stringify(next),actor.id]);
   }
   const result=await db.query('UPDATE classic_suggestions SET status=$2,reviewed_at=now(),reviewed_by=$3,review_note=$4,merged_version=$5 WHERE id=$1 RETURNING *',[suggestionId,action==='merge'?'merged':'rejected',actor.id,note,mergedVersion]);
   return suggestion(result.rows[0]);
  });res.json(reviewed);
 });
 app.delete('/api/admin/comments/:id',async(req,res)=>{
  const result=await pool.query('UPDATE classic_comments SET hidden_at=now(),hidden_by=$2 WHERE id=$1 AND hidden_at IS NULL RETURNING id',[uuid(req.params.id),res.locals.user.id]);
  if(!result.rowCount)throw new HttpError(404,'NOT_FOUND','评论已隐藏或不存在。');res.sendStatus(204);
 });
}
