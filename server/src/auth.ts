import type {Pool,PoolClient} from 'pg';
import {digest,newToken} from './security';
export type PublicUser={id:string;username:string;role:'user'|'admin';mustChangePassword:boolean};
export function publicUser(row:{id:string;username:string;role:'user'|'admin';must_change_password:boolean}):PublicUser{
  return {id:row.id,username:row.username,role:row.role,mustChangePassword:row.must_change_password};
}
export function validPassword(value:unknown):value is string{
  return typeof value==='string'&&Array.from(value).length>=10&&Array.from(value).length<=128;
}
export async function session(db:Pool|PoolClient,user:PublicUser){
  const token=newToken(),expiresAt=new Date(Date.now()+7*86400000).toISOString();
  await db.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',[digest(token),user.id,expiresAt]);
  return {user,token,expiresAt};
}
