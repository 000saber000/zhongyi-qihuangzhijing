import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync(new URL('../src/data/knowledge.json',import.meta.url),'utf8'));

test.beforeEach(async({page})=>{await page.route('**/api/knowledge',route=>route.fulfill({json:{items:catalog}}));});

for(const width of [1440,390])test(`vertical wheel scrolls the page without hiding category labels at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#library');
 const nav=page.getByRole('navigation',{name:'知识库分类'}),root=page.locator('.cosmic-content-scroll');
 await expect(nav.locator('canvas')).toBeVisible();await nav.hover();await page.mouse.wheel(0,80);
 await expect.poll(()=>root.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
 expect(await nav.evaluate(e=>e.scrollTop)).toBe(0);
 await root.evaluate(e=>{e.scrollTop=650;});await expect(page.locator('.library-header-nav')).toBeVisible();
 await nav.hover();await page.mouse.wheel(0,120);await page.waitForTimeout(200);
 expect(await nav.evaluate(e=>e.scrollTop)).toBe(0);
 expect(await nav.evaluate(e=>{const box=e.getBoundingClientRect(),button=e.querySelector('button')!.getBoundingClientRect();return button.top>=box.top&&button.bottom<=box.bottom;})).toBe(true);
 if(width===390){
  await page.mouse.wheel(240,0);await expect.poll(()=>nav.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);
 }
});

test('liquid category selection follows rapid clicks, filters content and resets',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:900});await page.goto('/#library');
 const nav=page.getByRole('navigation',{name:'知识库分类'}),canvas=nav.locator('canvas');
 await expect(canvas).toBeVisible({timeout:5000});await expect(nav.getByRole('button')).toHaveCount(10);
 const overlay=nav.locator('.gooey-nav__list--active');
 await nav.getByRole('button',{name:'基础理论',exact:true}).click();
 await expect.poll(()=>overlay.evaluate(e=>(e.style.clipPath.match(/M/g)||[]).length)).toBeGreaterThan(1);
 for(const name of ['方剂学','本草药物'])await nav.getByRole('button',{name,exact:true}).click();
 await expect(nav.getByRole('button',{name:'本草药物',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.library-grid .knowledge-card').first()).toHaveClass(/tone-药/);
 await page.getByRole('button',{name:'清空筛选'}).click();
 await expect(nav.getByRole('button',{name:'全部知识',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect.poll(()=>overlay.evaluate(e=>(e.style.clipPath.match(/M/g)||[]).length)).toBe(1);
 await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'学习路径',exact:true}).click();
 await expect(nav).toHaveCount(0);
 await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'知识库',exact:true}).click();
 await expect(nav.locator('canvas')).toBeVisible();expect(errors).toEqual([]);
});

for(const mode of ['reduced-motion','no-webgl'] as const)test(`category selection stays usable with ${mode}`,async({page})=>{
 await page.emulateMedia({reducedMotion:mode==='reduced-motion'?'reduce':'no-preference'});
 if(mode==='no-webgl')await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind:string,...args:any[]){return kind.includes('webgl')?null:(get as any).call(this,kind,...args);} as any;});
 await page.setViewportSize({width:390,height:844});await page.goto('/#library');
 const nav=page.getByRole('navigation',{name:'知识库分类'});
 await expect(nav.locator('.gooey-nav')).toBeVisible();
 const last=nav.getByRole('button',{name:'医案研读',exact:true});await last.focus();await page.keyboard.press('Enter');
 await expect(last).toBeFocused();await expect(last).toHaveAttribute('aria-pressed','true');await expect(last).toBeInViewport();
 await expect(page.locator('.library-grid .knowledge-card').first()).toHaveClass(/tone-案/);
 if(mode==='reduced-motion'){
  const paint=await nav.locator('canvas').boundingBox(),button=await last.boundingBox();
  expect(paint!.x+paint!.width).toBeGreaterThanOrEqual(button!.x+button!.width);
  await nav.evaluate(e=>{e.scrollLeft=e.scrollWidth;});
  const bounds=await nav.boundingBox(),end=await last.boundingBox();
  expect(bounds!.x+bounds!.width-end!.x-end!.width).toBeLessThan(12);
 }
 if(mode==='no-webgl')await expect(nav.locator('.gooey-nav__fallback')).toBeVisible();
});
