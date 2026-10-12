import {readFile} from 'node:fs/promises';
import type {Pool, PoolClient} from 'pg';
import {seedKnowledge,seedKeyPoints} from '../../src/data/catalog';

export async function migrate(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7348012)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    for(const [version,file] of [[1,'001-accounts.sql'],[2,'002-administration.sql'],[3,'003-knowledge.sql'],[4,'004-contributions.sql'],[5,'005-ai.sql']] as const){
      const applied=await client.query('SELECT version FROM schema_migrations WHERE version=$1',[version]);
      if(!applied.rowCount){
        await client.query(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
        if(version===3){
          for(const item of seedKnowledge){
            const content={...item,body:'',keyPoints:seedKeyPoints[item.id]??[]};
            await client.query('INSERT INTO knowledge_entries(id,draft,published) VALUES($1,$2,$2)',[item.id,JSON.stringify(content)]);
          }
        }
        await client.query('INSERT INTO schema_migrations(version) VALUES($1)',[version]);
      }
    }
    await client.query('COMMIT');
  } catch (error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
}
export async function transaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client=await pool.connect();
  try {await client.query('BEGIN');const result=await operation(client);await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export async function bootstrapAdmin(pool:Pool,username:string):Promise<string>{
  if(!/^[A-Za-z0-9_]{3,32}$/.test(username))throw new Error('Invalid INITIAL_ADMIN_USERNAME');
  return transaction(pool,async db=>{
    await db.query('SELECT pg_advisory_xact_lock(7348013)');
    const result=await db.query('SELECT id,username,role,disabled,must_change_password FROM users WHERE username_key=$1 FOR UPDATE',[username.toLowerCase()]);
    const user=result.rows[0];
    if(!user)throw new Error('INITIAL_ADMIN_USERNAME must identify an already registered account');
    if(user.disabled||user.must_change_password)throw new Error('Configured administrator account must be active');
    const existing=await db.query("SELECT id FROM users WHERE role='admin' AND id<>$1",[user.id]);
    if(existing.rowCount)throw new Error('A different administrator is already configured');
    if(user.role!=='admin'){
      await db.query("UPDATE users SET role='admin' WHERE id=$1",[user.id]);
      await db.query("INSERT INTO admin_audit(actor_username,target_id,target_username,action) VALUES('Render setup',$1,$2,'bootstrap')",[user.id,user.username]);
    }
    return user.id;
  });
}
