import {scrypt, randomBytes, timingSafeEqual, createHash} from 'node:crypto';
const N=16384, r=8, p=1;
function derive(password:string,salt:Buffer):Promise<Buffer>{
  return new Promise((resolve,reject)=>scrypt(password,salt,64,{N,r,p,maxmem:32*1024*1024},(error,key)=>error?reject(error):resolve(key)));
}
export async function hashPassword(password:string):Promise<string>{
  const salt=randomBytes(16), key=await derive(password,salt);
  return ['scrypt',N,r,p,salt.toString('hex'),key.toString('hex')].join('$');
}
export async function verifyPassword(password:string,record:string|null):Promise<boolean>{
  const fields=record?.split('$');
  const valid=fields?.length===6 && fields[0]==='scrypt' && fields[1]===String(N) && fields[2]===String(r) && fields[3]===String(p);
  const salt=valid?Buffer.from(fields![4],'hex'):Buffer.alloc(16);
  const expected=valid?Buffer.from(fields![5],'hex'):Buffer.alloc(64);
  const actual=await derive(password,salt);
  return expected.length===actual.length && timingSafeEqual(actual,expected) && Boolean(valid);
}
export const digest=(value:string):string=>createHash('sha256').update(value).digest('hex');
export const newToken=():string=>randomBytes(32).toString('base64url');
