import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const catalog=JSON.parse(readFileSync(new URL('../src/data/knowledge.json',import.meta.url),'utf8'));
test.beforeEach(async({page})=>{
 await page.route('**/api/knowledge',route=>route.fulfill({json:{items:catalog}}));
});

test('a classic opens while enlarging, fills the viewport and reveals its detail beneath the transition',async({page})=>{
 // Pause real browser animations as they are created so every handoff can be inspected.
 await page.addInitScript(()=>{
  const animate=Element.prototype.animate;
  Element.prototype.animate=function(keyframes,options){
   const animation=animate.call(this,keyframes,options);
   if(this.closest('.book-opening'))animation.pause();
   return animation;
  };
 });
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/#library');
 const card=page.getByRole('button',{name:'阅读 黄帝内经',exact:true});
 await card.scrollIntoViewIfNeeded();
 const original=await card.locator('.antique-book').boundingBox();
 await card.click();
 const opening=page.getByRole('dialog',{name:'正在翻开《黄帝内经》'});
 await expect(opening).toBeVisible();
 await expect(page).toHaveURL(/#library$/);
 await expect.poll(()=>opening.locator('.book-front').evaluate(element=>element.getAnimations().length)).toBeGreaterThan(0);
 await opening.evaluate(element=>{for(const animation of element.getAnimations({subtree:true}))animation.currentTime=800;});
 const enlarged=await opening.locator('.antique-book').boundingBox();
 expect(enlarged!.width).toBeGreaterThan(original!.width+20);
 expect(await opening.locator('.book-front').evaluate(element=>getComputedStyle(element).transform)).not.toBe('matrix(1, 0, 0, 1, 0, 0)');
 await expect(page).toHaveURL(/#library$/);
 await opening.evaluate(element=>{for(const animation of element.getAnimations({subtree:true})){const timing=animation.effect!.getTiming();animation.currentTime=Number(timing.delay)+Number(timing.duration)-1;}});
 const paper=await opening.locator('.book-endpaper').boundingBox();
 expect(paper!.x).toBeLessThanOrEqual(0);expect(paper!.y).toBeLessThanOrEqual(0);
 expect(paper!.x+paper!.width).toBeGreaterThanOrEqual(1440);expect(paper!.y+paper!.height).toBeGreaterThanOrEqual(900);
 await opening.evaluate(element=>{for(const animation of element.getAnimations({subtree:true}))animation.finish();});
 await expect(page).toHaveURL(/#knowledge\/classic-huangdi$/,{timeout:7000});
 await expect(opening).toBeVisible();
 await expect(page.locator('.detail-header h1')).toHaveText('黄帝内经');
 await expect.poll(()=>opening.evaluate(element=>element.getAnimations().length)).toBeGreaterThan(0);
 await opening.evaluate(element=>{for(const animation of element.getAnimations({subtree:true}))animation.finish();});
 await expect(page.getByRole('heading',{name:'黄帝内经',exact:true})).toBeVisible();
 await expect(opening).toHaveCount(0);
 await expect(page.locator('.detail-header h1')).toBeFocused();
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

test('browser back during the detail reveal cancels the overlay without returning to the detail',async({page})=>{
 await page.addInitScript(()=>{
  const animate=Element.prototype.animate;
  Element.prototype.animate=function(keyframes,options){
   const animation=animate.call(this,keyframes,options);
   if(this.closest('.book-opening'))animation.pause();
   return animation;
  };
 });
 await page.goto('/#library');
 await page.getByRole('button',{name:'阅读 金匮要略',exact:true}).click();
 const opening=page.getByRole('dialog');await expect(opening).toBeVisible();
 await opening.evaluate(element=>{for(const animation of element.getAnimations({subtree:true}))animation.finish();});
 await expect(page).toHaveURL(/#knowledge\/classic-jingui$/);
 await expect(opening).toBeVisible();
 await page.goBack();
 await expect(opening).toHaveCount(0);
 await page.waitForTimeout(800);
 await expect(page).toHaveURL(/#library$/);
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
