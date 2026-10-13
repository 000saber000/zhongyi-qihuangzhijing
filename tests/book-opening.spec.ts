import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const catalog=JSON.parse(readFileSync(new URL('../src/data/knowledge.json',import.meta.url),'utf8'));
test.beforeEach(async({page})=>{
 await page.route('**/api/knowledge',route=>route.fulfill({json:{items:catalog}}));
});

test('a classic enlarges and opens before entering its own detail page',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/#library');
 const card=page.getByRole('button',{name:'阅读 黄帝内经',exact:true});
 await card.scrollIntoViewIfNeeded();
 const original=await card.locator('.antique-book').boundingBox();
 await card.click();
 const opening=page.getByRole('dialog',{name:'正在翻开《黄帝内经》'});
 await expect(opening).toBeVisible();
 await expect(page).toHaveURL(/#library$/);
 await expect.poll(async()=>((await opening.locator('.antique-book').boundingBox())?.width??0)).toBeGreaterThan(original!.width+20);
 // Freeze the actual cover midway: reading must wait for its animation to finish.
 await page.waitForFunction(()=>document.querySelector('.book-opening .book-front')?.getAnimations().some(animation=>animation.playState==='running'));
 await opening.locator('.book-front').evaluate(element=>{const animation=element.getAnimations()[0];animation.pause();animation.currentTime=900;});
 await page.waitForTimeout(500);
 await expect(page).toHaveURL(/#library$/);
 await opening.locator('.book-front').evaluate(element=>element.getAnimations()[0].play());
 await expect(page).toHaveURL(/#knowledge\/classic-huangdi$/,{timeout:7000});
 await expect(page.getByRole('heading',{name:'黄帝内经',exact:true})).toBeVisible();
 await expect(opening).toHaveCount(0);
});

test('Escape cancels opening and restores focus without a delayed redirect',async({page})=>{
 await page.goto('/#library');
 const card=page.getByRole('button',{name:'阅读 本草纲目',exact:true});
 await card.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('dialog',{name:'正在翻开《本草纲目》'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(card).toBeFocused();
 await page.waitForTimeout(3200);
 await expect(page).toHaveURL(/#library$/);
});

test('leaving the library cancels the pending book navigation',async({page})=>{
 await page.goto('/#library');
 await page.getByRole('button',{name:'阅读 金匮要略',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.evaluate(()=>{location.hash='courses';});
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.waitForTimeout(3200);
 await expect(page).toHaveURL(/#courses$/);
});

test('mobile books open within the viewport and retain bookmark controls',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/#library');
 await page.getByRole('button',{name:'阅读 伤寒论',exact:true}).click();
 const opening=page.getByRole('dialog',{name:'正在翻开《伤寒论》'});
 await expect(opening).toBeVisible();
 await opening.locator('.book-opening-stage').evaluate(element=>{const animation=element.getAnimations()[0];animation.pause();animation.currentTime=640;});
 const book=await opening.locator('.antique-book').boundingBox();
 expect(book!.x).toBeGreaterThanOrEqual(0);
 expect(book!.x+book!.width).toBeLessThanOrEqual(390);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await opening.locator('.book-opening-stage').evaluate(element=>element.getAnimations()[0].play());
 await expect(page).toHaveURL(/#knowledge\/classic-shanghan$/,{timeout:7000});
 await page.getByRole('button',{name:'收藏知识',exact:true}).click();
 await expect(page.getByRole('button',{name:'取消收藏',exact:true})).toBeVisible();
});

test('reduced motion opens classics immediately without the 3D transition',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/#library');
 await page.getByRole('button',{name:'阅读 难经',exact:true}).click();
 await expect(page).toHaveURL(/#knowledge\/classic-nanjing$/,{timeout:1000});
 await expect(page.getByRole('dialog')).toHaveCount(0);
});
