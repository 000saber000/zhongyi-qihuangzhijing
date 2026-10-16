import {test,expect} from '@playwright/test';

test('vertical domain pills animate on hover and keep category selection independent of hover',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:900});await page.goto('/#home');
 const nav=page.getByRole('navigation',{name:'领域分类'});
 await expect(nav).toBeVisible();await expect(nav.getByRole('button')).toHaveCount(10);
 const all=nav.getByRole('button',{name:'筛选 全部知识',exact:true}),herbs=nav.getByRole('button',{name:'筛选 本草药物',exact:true});
 await expect(all).toHaveAttribute('aria-pressed','true');
 const first=await all.boundingBox(),last=await nav.getByRole('button',{name:'筛选 医案研读',exact:true}).boundingBox();
 expect(Math.abs(first!.x-last!.x)).toBeLessThan(1);expect(last!.y).toBeGreaterThan(first!.y);
 await herbs.hover();await expect(herbs.locator('..')).toHaveAttribute('data-hover','');
 await expect.poll(()=>herbs.locator('.pill-nav__fill').evaluate(e=>getComputedStyle(e).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
 await expect(all).toHaveAttribute('aria-pressed','true');await herbs.click();await expect(herbs).toHaveAttribute('aria-pressed','true');
 await page.mouse.move(700,500);await expect(herbs.locator('..')).toHaveAttribute('data-on','');await expect(all).toHaveAttribute('aria-pressed','false');
 await page.getByRole('textbox',{name:'搜索知识'}).fill('');await page.getByRole('textbox',{name:'搜索知识'}).focus();
 const results=page.locator('.cosmic-search-results').getByRole('button',{name:/^阅读 /});
 await expect(results.first()).toBeVisible();expect(await results.count()).toBeGreaterThan(0);
 await results.first().click();await expect(all).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('complementary',{name:'知识详情'})).toBeVisible();
 expect(errors).toEqual([]);
});

test.describe('touch domain navigation',()=>{
test.use({hasTouch:true});
test('touch, keyboard and reduced motion keep the domain rail usable without hiding bottom items',async({page})=>{
 await page.setViewportSize({width:390,height:700});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#home');
 const nav=page.getByRole('navigation',{name:'领域分类'}),last=nav.getByRole('button',{name:'筛选 医案研读',exact:true});
 await expect(last).toBeInViewport();await nav.getByRole('button',{name:'筛选 基础理论',exact:true}).tap();await expect(nav.getByRole('button',{name:'筛选 基础理论',exact:true})).toHaveAttribute('aria-pressed','true');
 await last.focus();await page.keyboard.press('Enter');await expect(last).toHaveAttribute('aria-pressed','true');await expect(last).toBeFocused();
 expect(await last.locator('.pill-nav__face').evaluate(e=>getComputedStyle(e).transitionDuration)).toBe('0s');
 await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'知识库',exact:true}).click();await expect(nav).toHaveCount(0);
 await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'知识图谱',exact:true}).click();await expect(nav).toBeVisible();await expect(last).toHaveAttribute('aria-pressed','true');
 expect(await page.locator('.universe').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
});
});
