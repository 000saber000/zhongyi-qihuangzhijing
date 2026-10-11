import {randomBytes} from 'node:crypto';
import type {Express,Request,RequestHandler} from 'express';
import type {Pool,PoolClient} from 'pg';
import {transaction} from './db';
import {HttpError,invalid} from './errors';
import {hashPassword,verifyPassword} from './security';
import {validPassword,type PublicUser} from './auth';

type Target={id:string;username:string;role:'user'|'admin';disabled:boolean};
function targetId(req:Request):string{
  const id=req.params.id;
  if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw invalid();
  return id;
}
async function target(db:PoolClient,id:string):Promise<Target>{
  const result=await db.query('SELECT id,username,role,disabled FROM users WHERE id=$1 FOR UPDATE',[id]);
  const row=result.rows[0];
  if(!row)throw new HttpError(404,'NOT_FOUND','没有找到这个账号。');
  if(row.role==='admin')throw new HttpError(409,'ADMIN_PROTECTED','管理员账号受到保护，请使用自己的修改密码入口。');
  return row;
}
async function confirmPassword(db:PoolClient,actor:PublicUser,password:unknown){
  if(!validPassword(password))throw invalid();
  const result=await db.query("SELECT password_hash FROM users WHERE id=$1 AND role='admin' AND NOT disabled FOR SHARE",[actor.id]);
  if(!await verifyPassword(password,result.rows[0]?.password_hash??null))throw new HttpError(403,'CONFIRMATION_FAILED','管理员密码不正确，请重新输入。');
}
async function audit(db:PoolClient,actor:PublicUser,user:Target,action:string){
  await db.query('INSERT INTO admin_audit(actor_id,actor_username,target_id,target_username,action) VALUES($1,$2,$3,$4,$5)',[actor.id,actor.username,user.id,user.username,action]);
}
export function installAdminRoutes(app:Express,pool:Pool,limit:RequestHandler){
  app.use('/api/admin',(_req,res,next)=>{
    if(res.locals.user.role!=='admin')throw new HttpError(403,'ADMIN_REQUIRED','需要管理员权限。');
    next();
  });
  app.get('/api/admin/users',async(req,res)=>{
    const search=req.query.q??'',pageValue=req.query.page??'1';
    if(typeof search!=='string'||search.length>32||typeof pageValue!=='string'||!/^[1-9]\d{0,6}$/.test(pageValue)||Number(pageValue)>1000000)throw invalid();
    const q=search.trim().toLowerCase(),page=Number(pageValue),pageSize=20;
    const [total,users]=await Promise.all([
      pool.query("SELECT count(*)::int AS total FROM users WHERE $1='' OR strpos(username_key,$1)>0",[q]),
      pool.query(`SELECT u.id,u.username,u.role,u.disabled,u.must_change_password AS "mustChangePassword",u.created_at AS "createdAt",
        (SELECT count(*)::int FROM bookmarks b WHERE b.user_id=u.id) AS "bookmarkCount",
        (SELECT count(*)::int FROM lesson_completions c WHERE c.user_id=u.id) AS "completedCount",
        (SELECT count(*)::int FROM sessions s WHERE s.user_id=u.id AND s.expires_at>now()) AS "activeSessions"
        FROM users u WHERE $1='' OR strpos(u.username_key,$1)>0 ORDER BY u.created_at DESC,u.id LIMIT $2 OFFSET $3`,[q,pageSize,(page-1)*pageSize])
    ]);
    res.json({users:users.rows,total:total.rows[0].total,page,pageSize});
  });
  app.get('/api/admin/audit',async(_req,res)=>{
    const result=await pool.query('SELECT id,actor_id AS "actorId",actor_username AS "actorUsername",target_id AS "targetId",target_username AS "targetUsername",action,created_at AS "createdAt" FROM admin_audit ORDER BY id DESC LIMIT 20');
    res.json({actions:result.rows});
  });
  app.put('/api/admin/users/:id/status',async(req,res)=>{
    const id=targetId(req),disabled=req.body?.disabled;
    if(typeof disabled!=='boolean')throw invalid();
    await transaction(pool,async db=>{
      const user=await target(db,id);
      if(user.disabled===disabled)return;
      await db.query('UPDATE users SET disabled=$2 WHERE id=$1',[id,disabled]);
      if(disabled)await db.query('DELETE FROM sessions WHERE user_id=$1',[id]);
      await audit(db,res.locals.user,user,disabled?'disable':'enable');
    });res.sendStatus(204);
  });
  app.post('/api/admin/users/:id/revoke-sessions',async(req,res)=>{
    const id=targetId(req);
    await transaction(pool,async db=>{
      const user=await target(db,id);
      await db.query('DELETE FROM sessions WHERE user_id=$1',[id]);
      await audit(db,res.locals.user,user,'revoke_sessions');
    });res.sendStatus(204);
  });
  app.post('/api/admin/users/:id/reset-password',limit,async(req,res)=>{
    const id=targetId(req),temporaryPassword=randomBytes(18).toString('base64url'),hash=await hashPassword(temporaryPassword);
    await transaction(pool,async db=>{
      const user=await target(db,id);
      await confirmPassword(db,res.locals.user,req.body?.adminPassword);
      await db.query('UPDATE users SET password_hash=$2,must_change_password=true WHERE id=$1',[id,hash]);
      await db.query('DELETE FROM sessions WHERE user_id=$1',[id]);
      await audit(db,res.locals.user,user,'reset_password');
    });res.json({temporaryPassword});
  });
  app.delete('/api/admin/users/:id',limit,async(req,res)=>{
    const id=targetId(req);
    await transaction(pool,async db=>{
      const user=await target(db,id);
      if(req.body?.confirmUsername!==user.username)throw invalid();
      await confirmPassword(db,res.locals.user,req.body?.adminPassword);
      await audit(db,res.locals.user,user,'delete');
      await db.query('DELETE FROM users WHERE id=$1',[id]);
    });res.sendStatus(204);
  });
}
