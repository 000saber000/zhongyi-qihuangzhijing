import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import type {Pool} from 'pg';
import {transaction} from '../db';
import {HttpError,invalid} from '../errors';
import type {PublicUser} from '../auth';
export const providers={deepseek:'https://api.deepseek.com/v1',qwen:'https://dashscope.aliyuncs.com/compatible-mode/v1',openai:'https://api.openai.com/v1'} as const;
export type Provider=keyof typeof providers;
export type ModelConfig={provider:Provider;model:string;enabled:boolean;dailyLimit:number;globalDailyLimit:number;maxTokens:number;version:number;encryptedKey:string|null};
export type AiOptions={encryptionKey?:string;fetch?:typeof globalThis.fetch};
const defaults:ModelConfig={provider:'deepseek',model:'deepseek-chat',enabled:false,dailyLimit:10,globalDailyLimit:200,maxTokens:1024,version:0,encryptedKey:null};
export function keyBytes(value:string|undefined):Buffer|null{
 if(!value||!/^[A-Za-z0-9+/]{43}=$/.test(value))return null;
 const key=Buffer.from(value,'base64');return key.length===32&&key.toString('base64')===value?key:null;
}
export function publicConfig(config:ModelConfig,options:AiOptions){const {encryptedKey,...safe}=config;return {...safe,hasKey:Boolean(encryptedKey),encryptionReady:Boolean(keyBytes(options.encryptionKey))};}
export function owner(user:PublicUser){return user.role==='admin'&&user.username.toLowerCase()==='aidejiasinuo';}
function fromRow(row:any):ModelConfig{
 return {provider:row.provider,model:row.model,enabled:row.enabled,dailyLimit:row.daily_limit,globalDailyLimit:row.global_daily_limit,maxTokens:row.max_tokens,version:row.version,encryptedKey:row.encrypted_key};
}
export async function loadConfig(pool:Pool):Promise<ModelConfig>{
 const {rows}=await pool.query('SELECT * FROM ai_settings WHERE id=1');return rows[0]?fromRow(rows[0]):{...defaults};
}
export async function stopConfig(pool:Pool,version:unknown,user:PublicUser,clear=false):Promise<ModelConfig>{
 if(!Number.isSafeInteger(version)||(version as number)<0||(version as number)>2147483646)throw invalid();
 return transaction(pool,async db=>{
  await db.query('INSERT INTO ai_settings(id) VALUES(1) ON CONFLICT DO NOTHING');
  const current=(await db.query('SELECT version FROM ai_settings WHERE id=1 FOR UPDATE')).rows[0];
  if(current.version!==version)throw new HttpError(409,'VERSION_CONFLICT','模型设置已在其他窗口更新，请重新载入。');
  const result=await db.query("UPDATE ai_settings SET enabled=false,encrypted_key=CASE WHEN $1 THEN NULL ELSE encrypted_key END,model=CASE WHEN $1 THEN '' ELSE model END,version=version+1,updated_by=$2,updated_at=now() WHERE id=1 RETURNING *",[clear,user.id]);
  await db.query("INSERT INTO admin_audit(actor_id,actor_username,target_id,target_username,action) VALUES($1,$2,$1,$2,'ai_config_update')",[user.id,user.username]);
  return fromRow(result.rows[0]);
 });
}
function encrypt(value:string,key:Buffer){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const bytes=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),bytes].map(value=>value.toString('base64')).join('.');}
export function decrypt(config:ModelConfig,options:AiOptions):string{
 const key=keyBytes(options.encryptionKey);if(!key||!config.encryptedKey)throw new HttpError(503,'AI_NOT_READY','学习助手尚未配置完成。');
 try{const [iv,tag,bytes]=config.encryptedKey.split('.').map(value=>Buffer.from(value,'base64'));const cipher=createDecipheriv('aes-256-gcm',key,iv);cipher.setAuthTag(tag);return Buffer.concat([cipher.update(bytes),cipher.final()]).toString('utf8');}
 catch{throw new HttpError(503,'AI_KEY_UNAVAILABLE','模型配置暂时无法读取，请联系管理员。');}
}
export async function saveConfig(pool:Pool,input:any,user:PublicUser,options:AiOptions){
 if(!input||typeof input!=='object'||Array.isArray(input))throw invalid();
 const integer=(value:unknown,min:number,max:number)=>{if(!Number.isSafeInteger(value)||(value as number)<min||(value as number)>max)throw invalid();return value as number;};
 const version=integer(input.version,0,2147483646),dailyLimit=integer(input.dailyLimit,1,100),globalDailyLimit=integer(input.globalDailyLimit,1,10000),maxTokens=integer(input.maxTokens,128,2048);
 if(typeof input.provider!=='string'||!Object.hasOwn(providers,input.provider)||typeof input.model!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,119}$/.test(input.model)||typeof input.enabled!=='boolean')throw invalid();
 const apiKey=input.apiKey??'';if(typeof apiKey!=='string'||(apiKey!==''&&!/^[\x21-\x7e]{12,512}$/.test(apiKey)))throw invalid();
 const key=keyBytes(options.encryptionKey);if(!key)throw new HttpError(503,'AI_ENCRYPTION_REQUIRED','服务端尚未配置模型密钥加密，请联系维护人员。');
 await transaction(pool,async db=>{
  await db.query('INSERT INTO ai_settings(id) VALUES(1) ON CONFLICT DO NOTHING');
  const current=(await db.query('SELECT * FROM ai_settings WHERE id=1 FOR UPDATE')).rows[0];
  if(current.version!==version)throw new HttpError(409,'VERSION_CONFLICT','模型设置已在其他窗口更新，请重新载入。');
  if(input.provider!==current.provider&&!apiKey)throw new HttpError(400,'AI_KEY_REQUIRED','更换模型厂商时，请填写对应的 API 密钥。');
  const encryptedKey=apiKey?encrypt(apiKey,key):current.encrypted_key;
  if(input.enabled&&!encryptedKey)throw new HttpError(400,'AI_KEY_REQUIRED','开启学习助手前，请先填写 API 密钥。');
  await db.query('UPDATE ai_settings SET provider=$1,model=$2,enabled=$3,encrypted_key=$4,daily_limit=$5,global_daily_limit=$6,max_tokens=$7,version=version+1,updated_by=$8,updated_at=now() WHERE id=1',[input.provider,input.model,input.enabled,encryptedKey,dailyLimit,globalDailyLimit,maxTokens,user.id]);
  await db.query("INSERT INTO admin_audit(actor_id,actor_username,target_id,target_username,action) VALUES($1,$2,$1,$2,'ai_config_update')",[user.id,user.username]);
 });
 return publicConfig(await loadConfig(pool),options);
}
