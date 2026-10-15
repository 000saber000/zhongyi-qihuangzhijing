import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chapterContent} from '../src/chapters';
import {chaptersFrom} from '../../src/data/chapters';
import {seedKnowledge} from '../../src/data/catalog';
import {prompt} from '../src/ai/retrieval';
import {createApp} from '../src/app';
import type {Pool} from 'pg';

test('chapter content preserves order and paragraph breaks',()=>{
 assert.deepEqual(chapterContent([{title:' 上篇 ',body:' 第一段。\n\n第二段。 '},{title:'下篇',body:''}]),[{title:'上篇',body:'第一段。\n\n第二段。'},{title:'下篇',body:''}]);
});
test('malformed chapters and oversized individual fields are rejected',()=>{
 for(const value of [null,{},[null],[{title:' ',body:'内容'}],[{title:'上篇',body:5}],[{title:'经'.repeat(121),body:''}],[{title:'上篇',body:'经'.repeat(50001)}],Array.from({length:501},()=>({title:'篇',body:''}))])assert.throws(()=>chapterContent(value));
});
test('a book can exceed the old single-body limit but stays within the total limit',()=>{
 const chapters=Array.from({length:40},(_,index)=>({title:'篇'+index,body:'经'.repeat(50000)}));
 assert.equal(chapterContent(chapters).length,40);
 assert.throws(()=>chapterContent([...chapters,{title:'末篇',body:'经'}]));
});
test('legacy body becomes one chapter while explicit chapters take precedence, including deletion',()=>{
 assert.deepEqual(chaptersFrom({body:'旧正文'}),[{title:'正文',body:'旧正文'}]);
 assert.deepEqual(chaptersFrom({body:'旧正文',chapters:[]}),[]);
 assert.deepEqual(chaptersFrom({body:'旧正文',chapters:[{title:'新篇',body:'新正文'}]}),[{title:'新篇',body:'新正文'}]);
});
test('AI references use published chapter text instead of a superseded legacy body',()=>{
 const reference=prompt([{...seedKnowledge[0],body:'过期正文',chapters:[{title:'上篇',body:'章节学习内容'}]}]);
 assert.ok(reference.includes('上篇\n章节学习内容'));assert.ok(!reference.includes('过期正文'));
});
test('chapter routes accept book-sized JSON while other endpoints keep their smaller limit',async()=>{
 const server=createApp({} as Pool,[]).listen(0,'127.0.0.1');
 await new Promise<void>(resolve=>server.once('listening',resolve));
 try{
  const base='http://127.0.0.1:'+(server.address() as {port:number}).port;
  const body=JSON.stringify({content:{chapters:Array.from({length:4},()=>({title:'篇',body:'经'.repeat(50000)}))}});
  for(const path of ['/api/admin/classics','/api/classics/classic-test/suggestions']){
   const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body});
   assert.equal(response.status,401);
  }
  const oversized=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body});
  assert.equal(oversized.status,400);assert.equal((await oversized.json() as {error:{message:string}}).error.message,'请求格式错误或内容过大。');
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
