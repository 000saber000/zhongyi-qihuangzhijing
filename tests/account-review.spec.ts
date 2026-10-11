import {test,expect,type Page} from '@playwright/test';
import {createRequire} from 'node:module';
const {Pool}=createRequire(import.meta.url)('../server/node_modules/pg');
test.use({reducedMotion:'reduce',viewport:{width:390,height:844}});
test.setTimeout(90000);
test.beforeEach(async()=>{const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL||'postgres://postgres:qihuang_test@127.0.0.1:55432/qihuang_test'});try{await pool.query('DELETE FROM auth_rate_limits');}finally{await pool.end();}});
async function seed(page:Page,guest=false){
 const response=await page.request.post('http://127.0.0.1:3001/api/auth/register',{data:{username:'Review_'+Date.now(),password:'test password 123'}});
 expect(response.status()).toBe(201);const session=await response.json();
 await page.addInitScript(({session,guest})=>{sessionStorage.setItem('qihuang-session',JSON.stringify(session));if(guest)localStorage.setItem('qihuang-bookmarks',JSON.stringify(['theory-yinyang']));},{session,guest});
 await page.goto('/#study');await expect(page.getByText('已同步到云端',{exact:true})).toBeVisible({timeout:15000});return session;
}
test('inaccessible guest storage is a retryable failure, not an empty saved record',async({page})=>{
 await page.addInitScript(()=>{const original=Storage.prototype.getItem;Storage.prototype.getItem=function(key){if(this===localStorage)throw new DOMException('blocked','SecurityError');return original.call(this,key);};});
 await page.goto('/#study');
 await expect(page.getByRole('alert')).toContainText('无法读取本地学习记录');
 await expect(page.getByText('保存在当前浏览器',{exact:true})).toHaveCount(0);
 await expect(page.getByText('书斋尚静，等待第一份收藏。')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'重新读取本地记录',exact:true})).toBeVisible();
});
test('ordinary writes are blocked while an import snapshot is pending after navigation',async({page})=>{
 await seed(page,true);let started=false;let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 await page.route('**/api/study/import',async route=>{const response=await route.fetch();started=true;await gate;await route.fulfill({response});});
 await page.getByRole('dialog',{name:'导入本地学习记录'}).getByRole('button',{name:'确认导入',exact:true}).click();await expect.poll(()=>started).toBe(true);
 await page.evaluate(()=>location.hash='knowledge/formula-guizhi');
 await expect(page.getByRole('button',{name:'收藏知识',exact:true})).toBeDisabled();
 release();await expect(page.getByRole('button',{name:'收藏知识',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'收藏知识',exact:true}).click();await expect(page.getByRole('button',{name:'取消收藏',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'我的书斋',exact:true}).click();await expect(page.getByRole('button',{name:'阅读 阴阳',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'阅读 桂枝汤',exact:true})).toBeVisible();
});
test('a concurrent write success cannot mask another write failure',async({page})=>{
 await seed(page);let aStarted=false,bStarted=false;let releaseA!:()=>void,releaseB!:()=>void;
 const gateA=new Promise<void>(resolve=>releaseA=resolve),gateB=new Promise<void>(resolve=>releaseB=resolve);
 await page.route('**/api/bookmarks/formula-guizhi',async route=>{aStarted=true;await gateA;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'UNAVAILABLE',message:'failed'}})});});
 await page.route('**/api/bookmarks/theory-yinyang',async route=>{bStarted=true;await gateB;await route.fulfill({status:204});});
 await page.evaluate(()=>location.hash='knowledge/formula-guizhi');await page.getByRole('button',{name:'收藏知识',exact:true}).click();await expect.poll(()=>aStarted).toBe(true);
 await page.evaluate(()=>location.hash='knowledge/theory-yinyang');await page.getByRole('button',{name:'收藏知识',exact:true}).click();await expect.poll(()=>bStarted).toBe(true);
 releaseA();await expect(page.getByRole('alert')).toHaveText('保存失败，请重试。');releaseB();await expect(page.getByRole('button',{name:'取消收藏',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'我的书斋',exact:true}).click();await expect(page.getByText('同步失败',{exact:true})).toBeVisible();await expect(page.getByText('已同步到云端',{exact:true})).toHaveCount(0);
});
