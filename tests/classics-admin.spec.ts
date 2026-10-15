import {test,expect,type Page} from '@playwright/test';
import {createRequire} from 'node:module';
const {Pool}=createRequire(import.meta.url)('../server/node_modules/pg');
test.use({reducedMotion:'reduce',viewport:{width:390,height:844}});
test.setTimeout(120000);
test.beforeEach(({page})=>{page.setDefaultTimeout(15000);});
const password='test password 123';
const base='http://127.0.0.1:3001';
async function login(page:Page,admin=true){
 const username='Editor_'+Date.now()+'_'+Math.floor(Math.random()*1000);
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL||'postgres://postgres:qihuang_test@127.0.0.1:55432/qihuang_test'});
 try{
  await pool.query('DELETE FROM auth_rate_limits');
  const registered=await page.request.post(base+'/api/auth/register',{data:{username,password}});
  expect(registered.status()).toBe(201);
  if(admin)await pool.query("UPDATE users SET role='admin' WHERE username_key=$1",[username.toLowerCase()]);
 }finally{await pool.end();}
 await page.goto('/#study');
 await page.getByRole('button',{name:'注册 / 登录',exact:true}).click();
 await page.getByLabel('用户名',{exact:true}).fill(username);
 await page.getByLabel('密码',{exact:true}).fill(password);
 await page.getByRole('button',{name:'登录账号',exact:true}).click();
 await expect(page.getByText('账号：'+username,{exact:true})).toBeVisible();
 return username;
}
async function fillClassic(page:Page,id:string){
 await page.getByRole('button',{name:'新增知识',exact:true}).click();
 await page.getByLabel('知识编号',{exact:true}).fill(id);
 await page.getByLabel('知识名称',{exact:true}).fill('测试新增知识');
 await page.getByLabel('内容简介',{exact:true}).fill('新增的典籍简介');
 await page.getByRole('button',{name:'添加章节',exact:true}).click();
 await page.getByLabel('章节标题',{exact:true}).fill('第一篇');
 await page.getByLabel('章节正文',{exact:true}).fill('第一段正文。\n第二段正文。');
 await page.getByLabel('文献出处',{exact:true}).fill('测试整理本·第一篇');
 await page.getByLabel('学习要点（每行一条）',{exact:true}).fill('先读正文');
}
test('admin creates a private draft, previews, publishes, and readers can search and bookmark it',async({page,browser})=>{
 await login(page);
 await page.getByRole('button',{name:'知识管理',exact:true}).click();
 const id='classic-browser-'+Date.now(),title='测试新增知识 '+id;await fillClassic(page,id);
 await page.getByLabel('知识名称',{exact:true}).fill(title);
 await page.getByRole('button',{name:'保存草稿',exact:true}).click();
 await expect(page.getByRole('status').getByText('草稿已保存')).toBeVisible();
 const publicBefore=await page.request.get(base+'/api/knowledge');
 expect((await publicBefore.json()).items.some((item:any)=>item.id===id)).toBe(false);
 await page.getByRole('button',{name:'预览内容',exact:true}).click();
 const preview=page.getByRole('region',{name:'知识预览'});
 await expect(preview.getByText('第一段正文。\n第二段正文。')).toBeVisible();
 await page.getByRole('button',{name:'发布知识',exact:true}).click();
 await expect(page.getByRole('status').getByText('知识已发布')).toBeVisible();
 const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844}});const reader=await context.newPage();reader.setDefaultTimeout(20000);
 try{
  const catalogRead=reader.waitForResponse(response=>response.url().endsWith('/api/knowledge'));
  await reader.goto('http://127.0.0.1:5173/#library');
  const catalogResponse=await catalogRead;expect(catalogResponse.status()).toBe(200);
  expect((await catalogResponse.json()).items.some((item:any)=>item.id===id&&item.title===title)).toBe(true);
  await reader.getByLabel('搜索知识',{exact:true}).fill(title);await reader.getByLabel('搜索知识',{exact:true}).press('Enter');
  await reader.getByRole('button',{name:'阅读 '+title,exact:true}).click();
  await expect(reader.getByText('先读正文',{exact:true})).toBeVisible();
  await reader.getByRole('button',{name:'开始阅读',exact:true}).click();
  await expect(reader.getByText('第一段正文。\n第二段正文。')).toBeVisible();
  await reader.getByRole('button',{name:'收藏知识',exact:true}).click();
  await reader.reload();
  await expect(reader.getByRole('button',{name:'取消收藏',exact:true})).toBeVisible();
  await reader.goto('http://127.0.0.1:5173/#universe/'+id);
  await expect(reader.getByRole('complementary',{name:'知识详情'}).getByRole('heading',{name:title})).toBeVisible();
 }finally{await context.close();}
});
test('ordinary accounts cannot open the editor',async({page})=>{
 await login(page,false);await expect(page.getByRole('button',{name:'知识管理',exact:true})).toHaveCount(0);
 await page.goto('/#classics');await expect(page.getByText('此功能仅供管理员使用。',{exact:true})).toBeVisible();
 await expect(page.getByLabel('知识名称',{exact:true})).toHaveCount(0);
});
test('session expiration preserves the unsaved draft and disables saving',async({page})=>{
 await page.setViewportSize({width:390,height:844});await login(page);
 await page.getByRole('button',{name:'知识管理',exact:true}).click();
 await fillClassic(page,'classic-expired-'+Date.now());
 await page.route('**/api/study',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:{code:'UNAUTHENTICATED',message:'expired'}})}));
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByText('登录已过期，请重新登录。',{exact:true}).first()).toBeVisible();
 await expect(page.getByLabel('知识名称',{exact:true})).toHaveValue('测试新增知识');
 await expect(page.getByRole('button',{name:'保存草稿',exact:true})).toBeDisabled();
});
test('conflict notice and reload remain available after the same administrator logs in again',async({page})=>{
 const username=await login(page);await page.getByRole('button',{name:'知识管理',exact:true}).click();
 const id='classic-conflict-'+Date.now();await fillClassic(page,id);
 await page.getByRole('button',{name:'保存草稿',exact:true}).click();
 await expect(page.getByRole('status').getByText('草稿已保存')).toBeVisible();
 const session=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('qihuang-session')!));
 const headers={Authorization:'Bearer '+session.token};
 const catalog=await page.request.get(base+'/api/admin/classics',{headers});
 const entry=(await catalog.json()).entries.find((entry:any)=>entry.draft.id===id);
 expect((await page.request.put(base+'/api/admin/classics/'+id,{headers,data:{version:entry.version,content:{...entry.draft,title:'另一个窗口的修改'}}})).status()).toBe(200);
 await page.getByLabel('知识名称',{exact:true}).fill('保留我的修改');
 await page.getByRole('button',{name:'保存草稿',exact:true}).click();
 await expect(page.getByRole('button',{name:'重新载入最新版本',exact:true})).toBeVisible();
 await page.route('**/api/study',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:{code:'UNAUTHENTICATED',message:'expired'}})}));
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.getByRole('button',{name:'注册 / 登录',exact:true}).click();await page.unroute('**/api/study');
 await page.getByLabel('用户名',{exact:true}).fill(username);await page.getByLabel('密码',{exact:true}).fill(password);
 await page.getByRole('button',{name:'登录账号',exact:true}).click();
 await expect(page.getByRole('button',{name:'注册 / 登录',exact:true})).toHaveCount(0);
 await expect(page.getByLabel('知识名称',{exact:true})).toHaveValue('保留我的修改');
 await expect(page.getByRole('button',{name:'重新载入最新版本',exact:true})).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'重新载入最新版本',exact:true}).click();
 await expect(page.getByLabel('知识名称',{exact:true})).toHaveValue('另一个窗口的修改');
 await expect(page.getByRole('button',{name:'保存草稿',exact:true})).toBeEnabled();
});
test('mobile editor retains input on save failure and warns before leaving unsaved work',async({page})=>{
 await page.setViewportSize({width:390,height:844});await login(page);
 await page.getByRole('button',{name:'知识管理',exact:true}).click();
 await fillClassic(page,'classic-failed-'+Date.now());
 await page.route('**/api/admin/classics',route=>route.request().method()==='POST'?route.abort():route.continue());
 await page.getByRole('button',{name:'保存草稿',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'云端连接失败'})).toBeVisible();
 await expect(page.getByLabel('知识名称',{exact:true})).toHaveValue('测试新增知识');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 page.once('dialog',dialog=>dialog.dismiss());
 await page.getByRole('button',{name:'知识库',exact:true}).click();
 await expect(page.getByLabel('知识名称',{exact:true})).toHaveValue('测试新增知识');
});
