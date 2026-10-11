import express, {type Request, type Response, type NextFunction} from 'express';
import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {transaction} from './db';
import {hashPassword,verifyPassword,newToken,digest} from './security';
import {knowledgeIds,lessonIds} from './catalog';

class HttpError extends Error {constructor(public status:number,public code:string,message:string){super(message);}}
const invalid=()=>new HttpError(400,'BAD_INPUT','输入格式不正确，请检查后重试。');
function credentials(body:unknown):{username:string;password:string}{
  if(!body || typeof body!=='object')throw invalid();
  const {username,password}=body as Record<string,unknown>;
  if(typeof username!=='string'||!/^[A-Za-z0-9_]{3,32}$/.test(username)||typeof password!=='string'||Array.from(password).length<10||Array.from(password).length>128)throw invalid();
  return {username,password};
}
async function study(db:Pool|PoolClient,userId:string){
  const [bookmarks,completed]=await Promise.all([
    db.query('SELECT knowledge_id FROM bookmarks WHERE user_id=$1 ORDER BY knowledge_id',[userId]),
    db.query('SELECT lesson_id FROM lesson_completions WHERE user_id=$1 ORDER BY lesson_id',[userId])
  ]);
  return {bookmarks:bookmarks.rows.map(row=>row.knowledge_id as string),completed:completed.rows.map(row=>row.lesson_id as string)};
}
async function session(db:Pool|PoolClient,user:{id:string;username:string}){
  const token=newToken(),expiresAt=new Date(Date.now()+7*86400000).toISOString();
  await db.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',[digest(token),user.id,expiresAt]);
  return {user,token,expiresAt};
}
export function createApp(pool:Pool,allowedOrigins:string[],options:{trustProxy?:number}={}){
  const app=express();app.disable('x-powered-by');app.set('trust proxy',options.trustProxy??false);
  app.use((req,res,next)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    const origin=req.get('Origin');
    if(origin&&!allowedOrigins.includes(origin))return next(new HttpError(403,'ORIGIN_DENIED','不允许来自此网站的请求。'));
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.vary('Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');}
    if(req.method==='OPTIONS'){res.sendStatus(204);return;}next();
  });
  app.use(express.json({limit:'64kb',strict:true}));
  app.get('/healthz',async(_req,res)=>{await pool.query('SELECT 1');res.json({status:'ok'});});
  const limit=async(req:Request,_res:Response,next:NextFunction)=>{
    const key=digest(req.ip??req.socket.remoteAddress??'unknown');
    const result=await pool.query(`INSERT INTO auth_rate_limits(ip_hash) VALUES($1)
      ON CONFLICT(ip_hash) DO UPDATE SET
      attempts=CASE WHEN auth_rate_limits.window_start < now()-interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts+1 END,
      window_start=CASE WHEN auth_rate_limits.window_start < now()-interval '15 minutes' THEN now() ELSE auth_rate_limits.window_start END
      RETURNING attempts`,[key]);
    if(result.rows[0].attempts>20)throw new HttpError(429,'RATE_LIMITED','尝试次数过多，请在 15 分钟后重试。');next();
  };
  app.post('/api/auth/register',limit,async(req,res)=>{
    const {username,password}=credentials(req.body),passwordHash=await hashPassword(password);
    try{
      const data=await transaction(pool,async client=>{
        const user={id:randomUUID(),username};
        await client.query('INSERT INTO users(id,username_key,username,password_hash) VALUES($1,$2,$3,$4)',[user.id,username.toLowerCase(),username,passwordHash]);
        return session(client,user);
      });res.status(201).json(data);
    }catch(error){if((error as {code?:string}).code==='23505')throw new HttpError(409,'USERNAME_TAKEN','这个用户名已被使用。');throw error;}
  });
  app.post('/api/auth/login',limit,async(req,res)=>{
    const {username,password}=credentials(req.body);
    const result=await pool.query('SELECT id,username,password_hash FROM users WHERE username_key=$1',[username.toLowerCase()]);
    const row=result.rows[0];
    if(!await verifyPassword(password,row?.password_hash??null))throw new HttpError(401,'INVALID_CREDENTIALS','用户名或密码不正确。');
    res.json(await session(pool,{id:row.id,username:row.username}));
  });
  app.post('/api/auth/logout',async(req,res)=>{
    const token=req.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if(token)await pool.query('DELETE FROM sessions WHERE token_hash=$1',[digest(token)]);
    res.sendStatus(204);
  });
  app.use('/api',async(req,res,next)=>{
    const token=req.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if(!token)throw new HttpError(401,'UNAUTHENTICATED','请重新登录。');
    const result=await pool.query('SELECT u.id,u.username,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[digest(token)]);
    const row=result.rows[0];if(!row)throw new HttpError(401,'UNAUTHENTICATED','登录已过期，请重新登录。');
    res.locals.user={id:row.id,username:row.username};res.locals.expiresAt=new Date(row.expires_at).toISOString();next();
  });
  app.get('/api/auth/me',(_req,res)=>{res.json({user:res.locals.user,expiresAt:res.locals.expiresAt});});
  app.get('/api/study',async(_req,res)=>{res.json(await study(pool,res.locals.user.id));});
  app.put('/api/bookmarks/:id',async(req,res)=>{
    if(!knowledgeIds.has(req.params.id))throw invalid();
    await pool.query('INSERT INTO bookmarks(user_id,knowledge_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[res.locals.user.id,req.params.id]);res.sendStatus(204);
  });
  app.delete('/api/bookmarks/:id',async(req,res)=>{
    if(!knowledgeIds.has(req.params.id))throw invalid();
    await pool.query('DELETE FROM bookmarks WHERE user_id=$1 AND knowledge_id=$2',[res.locals.user.id,req.params.id]);res.sendStatus(204);
  });
  app.put('/api/completions/:id',async(req,res)=>{
    if(!lessonIds.has(req.params.id))throw invalid();
    await pool.query('INSERT INTO lesson_completions(user_id,lesson_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[res.locals.user.id,req.params.id]);res.sendStatus(204);
  });
  app.post('/api/study/import',async(req,res)=>{
    const validate=(value:unknown,allowed:Set<string>):string[]=>{
      if(!Array.isArray(value)||value.length>500||value.some(id=>typeof id!=='string'||!allowed.has(id)))throw invalid();return [...new Set(value)];
    };
    const bookmarks=validate(req.body?.bookmarks,knowledgeIds),completed=validate(req.body?.completed,lessonIds);
    const data=await transaction(pool,async client=>{
      for(const id of bookmarks)await client.query('INSERT INTO bookmarks(user_id,knowledge_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[res.locals.user.id,id]);
      for(const id of completed)await client.query('INSERT INTO lesson_completions(user_id,lesson_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[res.locals.user.id,id]);
      return study(client,res.locals.user.id);
    });res.json(data);
  });
  app.use((_req,_res,next)=>next(new HttpError(404,'NOT_FOUND','没有找到这个接口。')));
  app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    if(error instanceof HttpError){res.status(error.status).json({error:{code:error.code,message:error.message}});return;}
    const parseStatus=(error as {status?:number})?.status;
    if(parseStatus===400||parseStatus===413){res.status(400).json({error:{code:'BAD_INPUT',message:'请求格式错误或内容过大。'}});return;}
    console.error('API request failed', {code:(error as {code?:string})?.code??'UNKNOWN'});
    res.status(503).json({error:{code:'UNAVAILABLE',message:'云端暂时不可用，请稍后重试。'}});
  });return app;
}
