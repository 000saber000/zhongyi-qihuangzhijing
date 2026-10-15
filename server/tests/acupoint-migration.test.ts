import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {migrate} from '../src/db';

test('expanded knowledge seeds fresh installs and upgrades without overwriting edited or unpublished records',async()=>{
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL||'postgres://postgres:qihuang_test@127.0.0.1:55432/qihuang_test',max:1});
 const schema='acupoint_upgrade_'+process.pid;
 try{
  await pool.query(`CREATE SCHEMA ${schema}`);
  await pool.query(`SET search_path TO ${schema}`);
  await migrate(pool);
  const fresh=(await pool.query("SELECT published FROM knowledge_entries WHERE id='point-zhongfu'")).rows[0];
  assert.match(fresh.published.body,/定位线索/,'fresh and upgraded installs must have the same article');
  await pool.query("UPDATE knowledge_entries SET draft=draft||'{\"body\":\"编辑保留内容\"}'::jsonb,published=NULL,version=7 WHERE id='point-zhongfu'");
  await pool.query("UPDATE knowledge_entries SET draft=draft||'{\"title\":\"编辑标题\"}'::jsonb,published=published||'{\"summary\":\"已发布修订\"}'::jsonb,version=9 WHERE id='point-feishu'");
  await pool.query("DELETE FROM knowledge_entries WHERE id IN ('point-weizhong','point-chize')");
  await pool.query('DELETE FROM schema_migrations WHERE version=6');
  await migrate(pool);
  const rows=(await pool.query("SELECT * FROM knowledge_entries WHERE id IN ('point-zhongfu','point-feishu','point-weizhong','point-chize') ORDER BY id")).rows;
  assert.equal(rows.length,4);
  const edited=rows.find(r=>r.id==='point-zhongfu');
  assert.equal(edited.published,null);assert.equal(edited.draft.body,'编辑保留内容');assert.equal(edited.version,7);
  const published=rows.find(r=>r.id==='point-feishu');
  assert.equal(published.draft.title,'编辑标题');assert.equal(published.published.summary,'已发布修订');assert.equal(published.version,9);
  for(const id of ['point-weizhong','point-chize'])assert.match(rows.find(r=>r.id===id).published.body,/定位线索/);
  await migrate(pool);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM schema_migrations WHERE version=6')).rows[0].count,1);
 }finally{await pool.query('SET search_path TO public');await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await pool.end();}
});
