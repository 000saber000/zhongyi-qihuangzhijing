import {test,expect,type Page} from '@playwright/test';
import {createRequire} from 'node:module';
const {Pool}=createRequire(import.meta.url)('../server/node_modules/pg');
const password='test password 123';
test.use({reducedMotion:'reduce',viewport:{width:390,height:844}});
test.setTimeout(90000);
test.beforeEach(async()=>{const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL||'postgres://postgres:qihuang_test@127.0.0.1:55432/qihuang_test'});try{await pool.query('DELETE FROM auth_rate_limits');}finally{await pool.end();}});
async function seed(page:Page){
 const username='Check_'+Date.now()+'_'+Math.floor(Math.random()*10000);
 const response=await page.request.post('http://127.0.0.1:3001/api/auth/register',{data:{username,password}});
 expect(response.status()).toBe(201);const session=await response.json();
 await page.addInitScript(value=>sessionStorage.setItem('qihuang-session',JSON.stringify(value)),session);
 await page.goto('/#study');await expect(page.getByText('已同步到云端',{exact:true})).toBeVisible();
 return session;
}
test('failed cloud write keeps the previous bookmark and shows a retryable failure',async({page})=>{
 await seed(page);
 await page.route('**/api/bookmarks/formula-guizhi',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'UNAVAILABLE',message:'test failure'}})}));
 await page.evaluate(()=>location.hash='knowledge/formula-guizhi');
 await page.getByRole('button',{name:'收藏知识',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveText('保存失败，请重试。');
 await expect(page.getByRole('button',{name:'收藏知识',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'我的书斋',exact:true}).click();
 await expect(page.getByText('同步失败',{exact:true})).toBeVisible();
 await expect(page.getByText('书斋尚静，等待第一份收藏。')).toBeVisible();
});
test('expired sessions clear account state and restore guest mode',async({page})=>{
 await seed(page);
 await page.route('**/api/study',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:{code:'UNAUTHENTICATED',message:'expired'}})}));
 await page.getByRole('button',{name:'刷新云端记录',exact:true}).click();
 await expect(page.getByRole('button',{name:'注册 / 登录',exact:true})).toBeVisible();
 await expect(page.getByRole('alert')).toHaveText('登录已过期，请重新登录。');
 expect(await page.evaluate(()=>sessionStorage.getItem('qihuang-session'))).toBeNull();
});
test('a delayed old-account read cannot populate a different account',async({page})=>{
 const previous=await seed(page);let started=false;let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 await page.route('**/api/study',async route=>{if(route.request().headers()['authorization']!=='Bearer '+previous.token){await route.continue();return;}started=true;await gate;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({bookmarks:['theory-yinyang'],completed:[]})});});
 await page.getByRole('button',{name:'刷新云端记录',exact:true}).click();await expect.poll(()=>started).toBe(true);
 await page.getByRole('button',{name:'退出登录',exact:true}).click();
 const username='Next_'+Date.now();await page.getByRole('button',{name:'注册 / 登录',exact:true}).click();await page.getByRole('button',{name:'注册新账号',exact:true}).click();
 await page.getByLabel('用户名',{exact:true}).fill(username);await page.getByLabel('密码',{exact:true}).fill(password);await page.getByRole('button',{name:'注册并登录',exact:true}).click();
 await expect(page.getByText('账号：'+username,{exact:true})).toBeVisible();release();
 await expect(page.getByText('已同步到云端',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'阅读 阴阳',exact:true})).toHaveCount(0);
});
test('a read started before a write cannot remove the acknowledged bookmark',async({page})=>{
 await seed(page);let started=false;let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 await page.route('**/api/study',async route=>{started=true;await gate;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({bookmarks:[],completed:[]})});});
 await page.getByRole('button',{name:'刷新云端记录',exact:true}).click();await expect.poll(()=>started).toBe(true);
 await page.evaluate(()=>location.hash='knowledge/formula-guizhi');await page.getByRole('button',{name:'收藏知识',exact:true}).click();
 await expect(page.getByRole('button',{name:'取消收藏',exact:true})).toBeVisible();release();
 await page.getByRole('button',{name:'我的书斋',exact:true}).click();await expect(page.getByRole('button',{name:'阅读 桂枝汤',exact:true})).toBeVisible();
});
test('session storage failure leaves the login dialog open without pretending success',async({page})=>{
 await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='qihuang-session')throw new DOMException('blocked','SecurityError');return original.call(this,key,value);};});
 await page.goto('/#study');await page.getByRole('button',{name:'注册 / 登录',exact:true}).click();await page.getByRole('button',{name:'注册新账号',exact:true}).click();
 await page.getByLabel('用户名',{exact:true}).fill('Storage_'+Date.now());await page.getByLabel('密码',{exact:true}).fill(password);await page.getByRole('button',{name:'注册并登录',exact:true}).click();
 await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('浏览器无法保存登录状态，请允许网站存储后重试。');
 expect(await page.evaluate(()=>sessionStorage.getItem('qihuang-session'))).toBeNull();
 await expect(page.getByText('已同步到云端',{exact:true})).toHaveCount(0);
 const dialog=await page.getByRole('dialog').boundingBox();expect(dialog!.x).toBeGreaterThanOrEqual(0);expect(dialog!.x+dialog!.width).toBeLessThanOrEqual(390);
});
test('failed import preserves guest records and allows retry',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('qihuang-bookmarks',JSON.stringify(['theory-yinyang'])));
 await seed(page);const dialog=page.getByRole('dialog',{name:'导入本地学习记录'});
 await page.route('**/api/study/import',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'UNAVAILABLE',message:'导入失败，请重试。'}})}));
 await dialog.getByRole('button',{name:'确认导入',exact:true}).click();await expect(dialog.getByRole('alert')).toHaveText('导入失败，请重试。');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('qihuang-bookmarks')!))).toEqual(['theory-yinyang']);
 await page.unroute('**/api/study/import');await dialog.getByRole('button',{name:'确认导入',exact:true}).click();await expect(page.getByRole('button',{name:'阅读 阴阳',exact:true})).toBeVisible();
});
