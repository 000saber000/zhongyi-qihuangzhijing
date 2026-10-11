import {Pool} from 'pg';
import {createApp} from './app';
import {migrate} from './db';

const connectionString=process.env.DATABASE_URL;
const origins=(process.env.ALLOWED_ORIGINS??'').split(',').map(value=>value.trim()).filter(Boolean);
if(!connectionString||!origins.length)throw new Error('DATABASE_URL and ALLOWED_ORIGINS are required');
const pool=new Pool({connectionString,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
pool.on('error',()=>console.error('PostgreSQL connection unavailable'));
await migrate(pool);
await pool.query('DELETE FROM sessions WHERE expires_at<now()');
await pool.query("DELETE FROM auth_rate_limits WHERE window_start<now()-interval '15 minutes'");
const server=createApp(pool,origins,{trustProxy:process.env.RENDER==='true'?1:0}).listen(Number(process.env.PORT??3001),'0.0.0.0',()=>console.log('Qihuang API listening'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.close(()=>{void pool.end().then(()=>process.exit(0));});setTimeout(()=>process.exit(1),10000).unref();});
