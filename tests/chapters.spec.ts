import {test,expect,type Page} from '@playwright/test';
import type {Knowledge} from '../src/data/catalog';

async function setup(page:Page){
 const original:Knowledge={id:'classic-chapter-demo',type:'经',title:'章节阅读示例',subtitle:'按篇阅读',summary:'全书导读保留在这里。',body:'旧正文第一段。\n\n旧正文第二段。',source:'示例整理本',confidence:'测试内容',tags:[],relations:[],keyPoints:['结合篇章语境阅读。']};
 let entry={draft:structuredClone(original),published:structuredClone(original),version:1,updatedAt:new Date().toISOString()};
 const user={id:'chapter-editor',username:'ChapterEditor',role:'admin',mustChangePassword:false};
 await page.addInitScript(user=>sessionStorage.setItem('qihuang-session',JSON.stringify({user,token:'a'.repeat(43),expiresAt:'2099-01-01T00:00:00Z'})),user);
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  let body:unknown={};
  if(path==='/api/auth/me')body={user,expiresAt:'2099-01-01T00:00:00Z'};
  else if(path==='/api/study')body={bookmarks:[],completed:[]};
  else if(path==='/api/knowledge')body={items:[entry.published]};
  else if(path==='/api/admin/suggestions')body={suggestions:[],total:0,page:1,pageSize:10,pendingCount:0};
  else if(path.endsWith('/comments'))body={comments:[],total:0,page:1,pageSize:20};
  else if(path.endsWith('/publish')){entry={...entry,published:structuredClone(entry.draft),version:entry.version+1};body=entry;}
  else if(path==='/api/admin/classics')body={entries:[entry]};
  else if(path==='/api/admin/classics/'+original.id&&request.method()==='PUT'){entry={...entry,draft:request.postDataJSON().content,version:entry.version+1};body=entry;}
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'Authorization, Content-Type','access-control-allow-methods':'GET, POST, PUT, OPTIONS'},body:JSON.stringify(body)});
 });
 return ()=>entry;
}

for(const viewport of [{width:1440,height:1000},{width:820,height:1000},{width:390,height:844}])test(`chapter editor and reader at ${viewport.width}px`,async({page},testInfo)=>{
 await page.setViewportSize(viewport);const current=await setup(page);
 await page.goto('/#classics');
 await page.getByRole('complementary',{name:'知识列表'}).getByRole('button').filter({hasText:'章节阅读示例'}).click();
 await expect(page.getByLabel('章节标题',{exact:true})).toHaveValue('正文');
 await expect(page.getByLabel('章节正文',{exact:true})).toHaveValue('旧正文第一段。\n\n旧正文第二段。');
 for(const [title,body] of [['中篇','稍后删除的章节。'],['末篇','末篇第一段。\n\n末篇第二段。']]){
  await page.getByRole('button',{name:'添加章节',exact:true}).click();
  await page.getByLabel('章节标题',{exact:true}).fill(title);await page.getByLabel('章节正文',{exact:true}).fill(body);
 }
 await page.getByRole('button',{name:'上移第3章',exact:true}).click();
 await expect(page.getByLabel('章节标题',{exact:true})).toHaveValue('末篇');
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'删除第3章',exact:true}).click();
 await page.getByRole('button',{name:'保存草稿',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'草稿已保存'})).toBeVisible();
 expect(current().draft.chapters?.map(chapter=>chapter.title)).toEqual(['正文','末篇']);
 expect(current().published.chapters).toBeUndefined();
 await page.getByRole('region',{name:'章节编辑器'}).evaluate(element=>element.scrollIntoView({block:'start'}));
 await page.screenshot({path:testInfo.outputPath('chapter-editor.png'),fullPage:true});
 await page.getByRole('button',{name:'预览内容',exact:true}).click();
 const preview=page.getByRole('region',{name:'知识预览'});
 await expect(preview.getByText('末篇第一段。\n\n末篇第二段。',{exact:true})).toBeVisible();
 await expect(preview.getByText('稍后删除的章节。',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'发布知识',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'知识已发布'})).toBeVisible();
 await page.getByRole('link',{name:'查看已发布内容 ↗'}).click();
 const reader=page.getByRole('region',{name:'章节阅读'});
 await expect(reader.getByRole('heading',{name:'全书导读',exact:true})).toBeVisible();
 await reader.getByRole('button',{name:'开始阅读',exact:true}).click();
 await expect(reader.getByRole('heading',{name:'正文',exact:true})).toBeVisible();
 await expect(reader.getByText('旧正文第一段。\n\n旧正文第二段。',{exact:true})).toBeVisible();
 await reader.getByRole('button',{name:'下一章',exact:true}).click();
 await expect(reader.getByRole('heading',{name:'末篇',exact:true})).toBeVisible();
 await expect(reader.getByText('末篇第一段。\n\n末篇第二段。',{exact:true})).toBeVisible();
 await expect(reader.getByRole('button',{name:'下一章',exact:true})).toBeDisabled();
 if(viewport.width<700)await reader.getByRole('button',{name:'章节目录'}).click();
 await reader.getByRole('navigation',{name:'章节目录'}).getByRole('button',{name:'全书导读',exact:true}).click();
 await expect(reader.getByRole('heading',{name:'全书导读',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await reader.getByRole('button',{name:'开始阅读',exact:true}).click();
 await page.screenshot({path:testInfo.outputPath('chapter-reader.png'),fullPage:true});
 const community=page.getByRole('region',{name:'知识讨论'});
 await community.getByRole('button',{name:'建议修改',exact:true}).click();
 await community.getByLabel('章节正文',{exact:true}).fill('根据版本核对后的第一章。');
 await community.getByLabel('修改理由 / 文献依据',{exact:true}).fill('核对第一章版本。');
 const submitted=page.waitForRequest(request=>request.url().endsWith('/suggestions')&&request.method()==='POST');
 await community.getByRole('button',{name:'提交修改建议',exact:true}).click();
 const suggestion=(await submitted).postDataJSON();
 expect(suggestion.base.chapters[0].body).toBe('旧正文第一段。\n\n旧正文第二段。');
 expect(suggestion.changes.chapters[0].body).toBe('根据版本核对后的第一章。');
});

test('legacy published body remains readable without saving an editor draft',async({page})=>{
 await setup(page);await page.goto('/#knowledge/classic-chapter-demo');
 const reader=page.getByRole('region',{name:'章节阅读'});
 await reader.getByRole('button',{name:'开始阅读',exact:true}).click();
 await expect(reader.getByText('旧正文第一段。\n\n旧正文第二段。',{exact:true})).toBeVisible();
});
