import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync(new URL('../src/data/knowledge.json',import.meta.url),'utf8'));
test.use({reducedMotion:'reduce'});
test.beforeEach(async({page})=>{
 await page.route('**/api/knowledge',route=>route.fulfill({json:{items:catalog}}));
 // Layout does not depend on GPU availability; exercise the supported static fallback.
 await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind:string,...args:any[]){return kind.includes('webgl')?null:(get as any).call(this,kind,...args);} as any;});
});
const links=[{name:'经络云图',title:'经络云图'},{name:'知识图谱',title:'万千医理，皆有星辰。'},{name:'学习路径',title:'循序而学，自成体系。'},{name:'我的书斋',title:'我的书斋'},{name:'知识库',title:'知识库'}];
async function boxes(page:Page){return page.getByRole('navigation',{name:'主导航'}).getByRole('button').evaluateAll(buttons=>buttons.map(button=>{const {x,y,width,height}=button.getBoundingClientRect();return {x,y,width,height};}));}
for(const width of [1440,1024,820,390])test(`main navigation stays fixed across routes and docked categories at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/#library');await expect(page.getByRole('heading',{name:'知识库',exact:true})).toBeVisible();
 const initial=await boxes(page);
 const assertStable=async(context:string)=>{const current=await boxes(page);expect(current).toHaveLength(6);for(let i=0;i<6;i++)for(const key of ['x','y','width','height'] as const)expect(Math.abs(current[i][key]-initial[i][key]),`${context}: button ${i} ${key}`).toBeLessThanOrEqual(1);};
 for(const link of links){await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:link.name,exact:true}).click();await expect(page.getByRole('heading',{name:link.title,exact:true})).toBeVisible();await assertStable(link.name);}
 await page.locator('.cosmic-content-scroll').evaluate(root=>{root.scrollTop=650;});await expect(page.locator('.library-header-nav')).toBeVisible();await assertStable('docked knowledge categories');
 const nav=page.getByRole('navigation',{name:'主导航'}),categories=page.getByRole('navigation',{name:'知识库分类'});
 const navBounds=(await nav.boundingBox())!,categoryBounds=(await categories.boundingBox())!;expect(categoryBounds.y).toBeGreaterThanOrEqual(navBounds.y+navBounds.height);
 for(const box of await boxes(page)){expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);}
 await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'经络云图',exact:true}).click();await expect(page.getByRole('heading',{name:'经络云图',exact:true})).toBeVisible();await assertStable('leaving docked library');
});
