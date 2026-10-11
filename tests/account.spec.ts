import {test,expect,type Page} from '@playwright/test';
import {createRequire} from 'node:module';
const {Pool}=createRequire(import.meta.url)('../server/node_modules/pg');
test.beforeEach(async()=>{const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL||'postgres://postgres:qihuang_test@127.0.0.1:55432/qihuang_test'});try{await pool.query('DELETE FROM auth_rate_limits');}finally{await pool.end();}});
test.use({reducedMotion:'reduce',viewport:{width:390,height:844}});
test.setTimeout(120000);
const password='test password 123';
const name=()=> 'User_'+Date.now()+'_'+Math.floor(Math.random()*10000);
async function authenticate(page:Page,username:string,register=true){
 await page.getByRole('button',{name:'注册 / 登录',exact:true}).click();
 if(register)await page.getByRole('button',{name:'注册新账号',exact:true}).click();
 await page.getByLabel('用户名', {exact:true}).fill(username);
 await page.getByLabel('密码', {exact:true}).fill(password);
 await page.getByRole('button',{name:register?'注册并登录':'登录账号',exact:true}).click();
 await expect(page.getByText('账号：'+username,{exact:true})).toBeVisible();
}
test('two devices share bookmarks and completed lessons without mixing guest data',async({page,browser})=>{
 const username=name();await page.goto('/#study');await authenticate(page,username);
 await page.goto('/#knowledge/formula-guizhi');await page.getByRole('button',{name:'收藏知识',exact:true}).click();
 await expect(page.getByRole('button',{name:'取消收藏',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'学习路径',exact:true}).click();
 await page.getByRole('button',{name:'开始学习 中医入门：建立知识框架',exact:true}).click();
 await page.getByRole('button',{name:'完成本节学习',exact:true}).click();
 await expect(page.getByRole('dialog').getByText('1 / 5 单元已完成')).toBeVisible();
 const context=await browser.newContext({baseURL:'http://127.0.0.1:5173',reducedMotion:'reduce',viewport:{width:390,height:844}});const other=await context.newPage();
 await other.goto('/#study');await authenticate(other,username,false);
 await expect(other.getByRole('button',{name:'阅读 桂枝汤',exact:true})).toBeVisible();
 await expect(other.getByText('已同步到云端',{exact:true})).toBeVisible();
 await other.getByRole('button',{name:'学习路径',exact:true}).click();await expect(other.getByText('1 / 5 单元已完成')).toBeVisible();
 await page.getByRole('button',{name:'关闭学习单元',exact:true}).click();await page.getByRole('button',{name:'我的书斋',exact:true}).click();
 await page.getByRole('button',{name:'退出登录',exact:true}).click();
 await expect(page.getByText('书斋尚静，等待第一份收藏。')).toBeVisible();await context.close();
});
test('local import is opt-in and leaves guest records intact',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('qihuang-bookmarks',JSON.stringify(['theory-yinyang'])));
 await page.goto('/#study');await authenticate(page,name());
 const prompt=page.getByRole('dialog',{name:'导入本地学习记录'});await expect(prompt).toBeVisible();
 await prompt.getByRole('button',{name:'暂不导入',exact:true}).click();
 await expect(page.getByText('书斋尚静，等待第一份收藏。')).toBeVisible();
 await page.getByRole('button',{name:'导入本地记录',exact:true}).click();await prompt.getByRole('button',{name:'确认导入',exact:true}).click();
 await expect(page.getByRole('button',{name:'阅读 阴阳',exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('button',{name:'阅读 阴阳',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'退出登录',exact:true}).click();await expect(page.getByRole('button',{name:'阅读 阴阳',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('qihuang-bookmarks')!))).toEqual(['theory-yinyang']);
});
