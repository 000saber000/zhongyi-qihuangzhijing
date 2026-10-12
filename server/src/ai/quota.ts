import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {transaction} from '../db';
import {HttpError} from '../errors';
import type {ModelConfig} from './config';
export type Reservation={id:string;userId:string;day:string;remaining:number};
export async function usage(pool:Pool,userId:string,config:ModelConfig){
 const result=await pool.query("SELECT scope,used FROM ai_usage WHERE day=(now() AT TIME ZONE 'Asia/Shanghai')::date AND scope=ANY($1::text[])",[[userId,'*']]);
 const used=result.rows.find(row=>row.scope===userId)?.used??0,globalUsed=result.rows.find(row=>row.scope==='*')?.used??0;
 return {remaining:Math.max(0,config.dailyLimit-used),dailyLimit:config.dailyLimit,globalAvailable:globalUsed<config.globalDailyLimit};
}
export async function reserve(pool:Pool,userId:string,config:ModelConfig):Promise<Reservation>{
 return transaction(pool,async db=>{
  const {day}=(await db.query("SELECT to_char(now() AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') AS day")).rows[0];
  for(const scope of ['*',userId])await db.query('INSERT INTO ai_usage(day,scope) VALUES($1,$2) ON CONFLICT DO NOTHING',[day,scope]);
  const global=(await db.query("SELECT used FROM ai_usage WHERE day=$1 AND scope='*' FOR UPDATE",[day])).rows[0];
  const user=(await db.query('SELECT used FROM ai_usage WHERE day=$1 AND scope=$2 FOR UPDATE',[day,userId])).rows[0];
  if(global.used>=config.globalDailyLimit)throw new HttpError(429,'AI_GLOBAL_LIMIT','今日学习助手总额度已用完，请明天再来。');
  if(user.used>=config.dailyLimit)throw new HttpError(429,'AI_DAILY_LIMIT','今日提问额度已用完，北京时间零点重置。');
  const id=randomUUID();
  const active=await db.query("INSERT INTO ai_activity(user_id,request_id,expires_at) VALUES($1,$2,now()+interval '120 seconds') ON CONFLICT(user_id) DO UPDATE SET request_id=$2,expires_at=now()+interval '120 seconds' WHERE ai_activity.expires_at<now() RETURNING user_id",[userId,id]);
  if(!active.rowCount)throw new HttpError(429,'AI_BUSY','已有回答正在生成，请等待或停止后再提问。');
  await db.query('UPDATE ai_usage SET used=used+1 WHERE day=$1 AND scope=ANY($2::text[])',[day,['*',userId]]);
  return {id,userId,day,remaining:config.dailyLimit-user.used-1};
 });
}
export async function release(pool:Pool,reservation:Reservation,refund:boolean){
 await transaction(pool,async db=>{
  if(refund)await db.query('UPDATE ai_usage SET used=GREATEST(0,used-1) WHERE day=$1 AND scope=ANY($2::text[])',[reservation.day,['*',reservation.userId]]);
  await db.query('DELETE FROM ai_activity WHERE user_id=$1 AND request_id=$2',[reservation.userId,reservation.id]);
 });
}
