import type {Express} from 'express';
import type {Pool} from 'pg';
import {categories,type Knowledge} from '../../src/data/catalog';
import {HttpError,invalid} from './errors';

const entry=(row:any)=>({draft:row.draft as Knowledge,published:row.published as Knowledge|null,version:row.version as number,updatedAt:new Date(row.updated_at).toISOString()});
export async function publishedIds(pool:Pool){
  const rows=await pool.query('SELECT id FROM knowledge_entries WHERE published IS NOT NULL');
  return new Set<string>(rows.rows.map(row=>row.id));
}
async function content(pool:Pool,value:unknown):Promise<Knowledge>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw invalid();
  const input=value as Record<string,unknown>;
  const text=(key:string,max:number,required=true)=>{
    const field=input[key];
    if(typeof field!=='string'||field.length>max||(required&&!field.trim()))throw invalid();
    return field.trim();
  };
  const list=(key:string,max:number,itemMax:number)=>{
    const field=input[key];
    if(!Array.isArray(field)||field.length>max||field.some(item=>typeof item!=='string'||!item.trim()||item.length>itemMax))throw invalid();
    return [...new Set((field as string[]).map(item=>item.trim()))];
  };
  const id=text('id',80),type=text('type',10);
  if(!/^[a-z][a-z0-9-]{2,79}$/.test(id)||type==='全部'||!categories.some(c=>c.type===type))throw invalid();
  const result:Knowledge={id,type,title:text('title',120),subtitle:text('subtitle',240,false),summary:text('summary',4000),body:text('body',50000,false),source:text('source',1000),confidence:text('confidence',120),tags:list('tags',20,60),relations:list('relations',50,80),keyPoints:list('keyPoints',20,1000)};
  const allowed=await publishedIds(pool);
  if(result.relations.some(related=>related===id||!allowed.has(related)))throw new HttpError(400,'BAD_RELATION','关联知识必须是已发布条目，且不能关联自身。');
  return result;
}
function version(value:unknown):number{
  if(!Number.isSafeInteger(value)||(value as number)<1)throw invalid();return value as number;
}
export function publicKnowledge(app:Express,pool:Pool){
  app.get('/api/knowledge',async(_req,res)=>{
    const result=await pool.query('SELECT published FROM knowledge_entries WHERE published IS NOT NULL ORDER BY id');
    res.json({items:result.rows.map(row=>row.published)});
  });
}
export function adminKnowledge(app:Express,pool:Pool){
  app.use('/api/admin',(_req,res,next)=>{
    if(res.locals.user.role!=='admin')throw new HttpError(403,'ADMIN_REQUIRED','此功能仅供管理员使用。');next();
  });
  app.get('/api/admin/classics',async(_req,res)=>{
    const result=await pool.query("SELECT * FROM knowledge_entries ORDER BY updated_at DESC,id");
    res.json({entries:result.rows.map(entry)});
  });
  app.post('/api/admin/classics',async(req,res)=>{
    const draft=await content(pool,req.body?.content);
    const result=await pool.query('INSERT INTO knowledge_entries(id,draft,updated_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING *',[draft.id,JSON.stringify(draft),res.locals.user.id]);
    if(!result.rowCount)throw new HttpError(409,'ID_EXISTS','这个编号已存在，请使用其他编号。');
    res.status(201).json(entry(result.rows[0]));
  });
  app.put('/api/admin/classics/:id',async(req,res)=>{
    const draft=await content(pool,req.body?.content),expected=version(req.body?.version);
    if(draft.id!==req.params.id)throw invalid();
    const existing=await pool.query('SELECT draft FROM knowledge_entries WHERE id=$1',[draft.id]);
    if(!existing.rowCount)throw new HttpError(404,'NOT_FOUND','未找到这条知识。');
    if(existing.rows[0].draft.type!==draft.type)throw invalid();
    const result=await pool.query('UPDATE knowledge_entries SET draft=$2,version=version+1,updated_by=$3,updated_at=now() WHERE id=$1 AND version=$4 RETURNING *',[draft.id,JSON.stringify(draft),res.locals.user.id,expected]);
    if(!result.rowCount)throw new HttpError(409,'VERSION_CONFLICT','内容已在其他窗口更新，请重新载入最新版本后编辑。');
    res.json(entry(result.rows[0]));
  });
  app.post('/api/admin/classics/:id/publish',async(req,res)=>{
    const expected=version(req.body?.version);
    const result=await pool.query("UPDATE knowledge_entries SET published=draft,version=version+1,updated_by=$3,updated_at=now() WHERE id=$1 AND version=$2 RETURNING *",[req.params.id,expected,res.locals.user.id]);
    if(!result.rowCount){
      const existing=await pool.query("SELECT id FROM knowledge_entries WHERE id=$1",[req.params.id]);
      if(!existing.rowCount)throw new HttpError(404,'NOT_FOUND','未找到这条知识。');
      throw new HttpError(409,'VERSION_CONFLICT','内容已在其他窗口更新，请重新载入最新版本后发布。');
    }
    res.json(entry(result.rows[0]));
  });
}
