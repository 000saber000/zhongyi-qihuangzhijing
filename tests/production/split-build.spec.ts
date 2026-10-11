import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.beforeEach(async({page})=>{
 const items=JSON.parse(await readFile(new URL('../../src/data/knowledge.json',import.meta.url),'utf8'));
 await page.route('**/api/knowledge',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({items})}));
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
  await expect(page.getByRole('heading',{name:'让知识，有迹可循。',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'学习路径',exact:true}).click();
  await expect(page.getByRole('heading',{name:'循序而学，自成体系。',exact:true})).toBeVisible();
  release();
  await page.locator('.universe-stage[data-ready="true"]').waitFor();
  await page.locator('canvas').evaluate(canvas=>canvas.setAttribute('data-persist-check','same-canvas'));
  await page.getByRole('button',{name:'我的书斋',exact:true}).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-persist-check','same-canvas');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{release();}
});

test('a failed scene download keeps the knowledge library usable',async({page})=>{
 await page.route('**/assets/UniverseCanvas-*.js',route=>route.abort());
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'当前设备无法显示三维星系',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'打开知识库',exact:true}).click();
 await expect(page.getByRole('heading',{name:'让知识，有迹可循。',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'阅读 黄帝内经',exact:true}).click();
 await expect(page.getByRole('heading',{name:'黄帝内经',exact:true})).toBeVisible();
});
