import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.beforeEach(async({page})=>{
 const items=JSON.parse(await readFile(new URL('../../src/data/knowledge.json',import.meta.url),'utf8'));
 await page.route('**/api/knowledge',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({items})}));
});

test('built mobile chat receives a reply without AbortSignal static helpers',async({page})=>{
 const session={user:{id:'release-chat-user',username:'ReleaseLearner',role:'user',mustChangePassword:false},token:'t'.repeat(43),expiresAt:new Date(Date.now()+3600000).toISOString()};
 await page.addInitScript(session=>{
  sessionStorage.setItem('qihuang-session',JSON.stringify(session));
  for(const method of ['timeout','any'])Object.defineProperty(AbortSignal,method,{value:undefined,configurable:true});
 },session);
 await page.route('**/api/auth/me',route=>route.fulfill({json:{user:session.user,expiresAt:session.expiresAt}}));
 await page.route('**/api/study',route=>route.fulfill({json:{bookmarks:[],completed:[]}}));
 await page.route('**/api/ai/status',route=>route.fulfill({json:{enabled:true,remaining:10,dailyLimit:10,globalAvailable:true,resetTimezone:'Asia/Shanghai'}}));
 await page.route('**/api/ai/chat',route=>route.fulfill({contentType:'text/event-stream',body:'event: delta\ndata: {"text":"手机版可以正常收到回答。"}\n\nevent: done\ndata: {"ok":true}\n\n'}));
 await page.goto('/#library');await page.getByRole('button',{name:'问岐黄',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'岐黄学习助手'});
 await dialog.getByLabel('向岐黄提问',{exact:true}).fill('你好');await dialog.getByLabel('发送提问',{exact:true}).click();
 await expect(dialog.locator('.ai-answer>p')).toHaveText('手机版可以正常收到回答。');await expect(dialog.getByRole('alert')).toHaveCount(0);
 await expect(dialog.getByLabel('向岐黄提问',{exact:true})).toBeEnabled();
});

test('production serves separate scripts and styles and preserves guest learning',async({page,request})=>{
 const response=await request.get('/');const html=await response.text();
 expect(html.length).toBeLessThan(5000);
 const resources=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match=>match[1]);
 expect(resources.some(path=>path.endsWith('.js'))).toBe(true);
 expect(resources.some(path=>path.endsWith('.css'))).toBe(true);
 for(const path of resources)expect((await request.get(path)).ok()).toBe(true);
 await page.goto('/#knowledge/classic-huangdi');
 await expect(page.getByRole('heading',{name:'黄帝内经',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'收藏知识',exact:true}).click();
 await page.getByRole('button',{name:'学习路径',exact:true}).click();
 await page.getByRole('button',{name:'开始学习 中医入门：建立知识框架',exact:true}).click();
 await page.getByRole('button',{name:'完成本节学习',exact:true}).click();
 await page.reload();
 await expect(page.getByText('1 / 5 单元已完成',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'我的书斋',exact:true}).click();
 await expect(page.getByRole('button',{name:'阅读 黄帝内经',exact:true})).toBeVisible();
});

test('navigation is available while the three-dimensional scene downloads',async({page})=>{
 let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve);
 let started!:()=>void;const downloading=new Promise<void>(resolve=>started=resolve);
 await page.route('**/assets/UniverseCanvas-*.js',async route=>{started();await held;await route.continue();});
 try{
  await page.goto('/');
  await expect(page.locator('.universe-loading')).toBeVisible();
  await downloading;
  await page.getByRole('button',{name:'知识库',exact:true}).click();
  await expect(page.getByRole('heading',{name:'知识库',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'学习路径',exact:true}).click();
  await expect(page.getByRole('heading',{name:'循序而学，自成体系。',exact:true})).toBeVisible();
  release();
  await page.locator('.universe-stage[data-ready="true"]').waitFor();
  await page.locator('.universe-stage canvas').evaluate(canvas=>canvas.setAttribute('data-persist-check','same-canvas'));
  await page.getByRole('button',{name:'我的书斋',exact:true}).click();
  await expect(page.locator('.universe-stage canvas')).toHaveAttribute('data-persist-check','same-canvas');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{release();}
});

test('a failed scene download keeps the knowledge library usable',async({page})=>{
 await page.route('**/assets/UniverseCanvas-*.js',route=>route.abort());
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'当前设备无法显示三维星系',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'打开知识库',exact:true}).click();
 await expect(page.getByRole('heading',{name:'知识库',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'阅读 黄帝内经',exact:true}).click();
 await expect(page.getByRole('heading',{name:'黄帝内经',exact:true})).toBeVisible();
});
