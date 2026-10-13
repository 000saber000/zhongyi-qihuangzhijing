import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync(new URL('../src/data/knowledge.json',import.meta.url),'utf8'));
test.use({reducedMotion:'reduce'});
test.beforeEach(async({page})=>{await page.route('**/api/knowledge',route=>route.fulfill({json:{items:catalog}}));});
test('library categories gather in the center while scrolling and still filter content',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/#library');
 const nav=page.getByRole('navigation',{name:'知识库分类'}),root=page.locator('.cosmic-content-scroll');await expect(nav).toBeVisible();
 await page.screenshot({path:'/workspace/artifacts/qihuang-ui/library-desktop.png'});
 await expect(nav.getByRole('button',{name:'全部知识',exact:true})).toHaveAttribute('aria-pressed','true');
 const initial=await nav.boundingBox();await root.evaluate(e=>{e.scrollTop=650;});
 await expect.poll(async()=>Math.round((await nav.boundingBox())!.y)).toBeLessThan(Math.round(initial!.y));
 await expect.poll(async()=>(await nav.boundingBox())!.width).toBeLessThan(initial!.width);
 const floated=await nav.boundingBox(),scroll=await root.boundingBox(),search=await page.locator('.universe-search').boundingBox();
 expect(floated!.y).toBeGreaterThanOrEqual(search!.y+search!.height);expect(floated!.y).toBeGreaterThan(scroll!.y);expect(Math.abs(floated!.x+floated!.width/2-720)).toBeLessThan(3);
 expect(floated!.width).toBeLessThan(initial!.width);
 await page.screenshot({path:'/workspace/artifacts/qihuang-ui/library-desktop-docked.png'});
 await root.evaluate(e=>{e.scrollTop=950;});await expect.poll(async()=>Math.round((await nav.boundingBox())!.y)).toBe(Math.round(floated!.y));
 await nav.getByRole('button',{name:'本草药物',exact:true}).click();await expect(nav.getByRole('button',{name:'本草药物',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.library-grid .knowledge-card').first()).toHaveClass(/tone-药/);
 await root.evaluate(e=>{e.scrollTop=0;});await expect.poll(async()=>Math.round((await nav.boundingBox())!.y)).toBe(Math.round(initial!.y));
 await page.getByRole('button',{name:'学习路径',exact:true}).click();await expect(nav).toHaveCount(0);
});
test('mobile jade cards keep long published titles within their text area',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.route('**/api/knowledge',route=>route.fulfill({json:{items:[{...catalog[0],title:'CaseStudy'+('179181967657').repeat(8)}]}}));await page.goto('/#library');
 const title=page.locator('.library-grid .card-copy h3').first();await expect(title).toContainText('CaseStudy');
 expect(await title.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
});
test('mobile floating categories scroll horizontally, retain keyboard access, and do not cover search',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/#library');const nav=page.getByRole('navigation',{name:'知识库分类'}),root=page.locator('.cosmic-content-scroll');await expect(nav).toBeVisible();
 expect(await root.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);await root.evaluate(e=>{e.scrollTop=600;});
 await expect.poll(async()=>(await nav.boundingBox())!.y).toBeLessThan(190);
 await page.locator('.library-nav-slot.is-docked').waitFor();
 const box=await nav.boundingBox(),search=await page.locator('.universe-search').boundingBox();expect(box!.y).toBeGreaterThanOrEqual(search!.y+search!.height);expect(box!.x).toBeGreaterThanOrEqual(10);expect(box!.x+box!.width).toBeLessThanOrEqual(380);
 await page.screenshot({path:'/workspace/artifacts/qihuang-ui/library-mobile-docked.png'});
 const last=nav.getByRole('button',{name:'医案研读',exact:true});await last.focus();await page.keyboard.press('Enter');await expect(last).toHaveAttribute('aria-pressed','true');await expect(last).toBeInViewport();await expect(page.locator('.library-grid .knowledge-card').first()).toHaveClass(/tone-案/);
 expect(await root.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 await page.setViewportSize({width:1200,height:900});await expect(nav).toBeVisible();await expect(last).toHaveAttribute('aria-pressed','true');
});
