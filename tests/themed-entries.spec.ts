import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const catalog=JSON.parse(readFileSync(new URL('../src/data/knowledge.json',import.meta.url),'utf8'));
test.beforeEach(async({page})=>{
 await page.route('**/api/knowledge',route=>route.fulfill({json:{items:catalog}}));
});

for(const entry of [
 {name:'桂枝',id:'herb-guizhi',kind:'herb'},
 {name:'桂枝汤',id:'formula-guizhi',kind:'formula'},
 {name:'足阳明胃经',id:'meridian-stomach',kind:'meridian'},
 {name:'阴阳',id:'theory-yinyang',kind:'theory'},
 {name:'足三里',id:'point-zusanli',kind:'acupoint'},
 {name:'八纲辨证',id:'method-bazheng',kind:'diagnosis'},
 {name:'张仲景',id:'person-zhangzhongjing',kind:'physician'}
])test(`${entry.kind} has its own short transition and opens the correct article`,async({page})=>{
 await page.addInitScript(()=>{
  const animate=Element.prototype.animate;
  Element.prototype.animate=function(keyframes,options){const animation=animate.call(this,keyframes,options);if(this.closest('.book-opening'))animation.pause();return animation;};
 });
 await page.goto('/#library');
 const card=page.getByRole('button',{name:`阅读 ${entry.name}`,exact:true});await card.click();
 const transition=page.getByRole('dialog',{name:`正在打开《${entry.name}》`});
 await expect(transition).toBeVisible();await expect(page).toHaveURL(/#library$/);
 await expect(transition).toHaveAttribute('data-kind',entry.kind);
 const animations=await transition.evaluate(element=>element.getAnimations({subtree:true}).map(animation=>{const timing=animation.effect!.getTiming();return Number(timing.delay)+Number(timing.duration);}));
 expect(animations.length).toBeGreaterThan(1);expect(Math.max(...animations)).toBeLessThanOrEqual(1250);
 const distinctive:Record<string,string>={theory:'.jade-halves',acupoint:'.acupoint-ripple',diagnosis:'.diagnosis-leaf-0',physician:'.physician-name-seal'};
 if(distinctive[entry.kind]){
  const motif=transition.locator(distinctive[entry.kind]);
  const initial=await motif.evaluate(element=>getComputedStyle(element).transform);
  await transition.evaluate(element=>{for(const animation of element.getAnimations({subtree:true}))animation.currentTime=350;});
  expect(await motif.evaluate(element=>getComputedStyle(element).transform)).not.toBe(initial);
  await transition.evaluate(element=>{for(const animation of element.getAnimations({subtree:true})){const timing=animation.effect!.getTiming();animation.currentTime=Number(timing.delay)+Number(timing.duration)-1;}});
  const sheet=await transition.locator('.knowledge-artwork').boundingBox(),viewport=page.viewportSize()!;
  expect(sheet!.x).toBeLessThanOrEqual(0);expect(sheet!.y).toBeLessThanOrEqual(0);
  expect(sheet!.x+sheet!.width).toBeGreaterThanOrEqual(viewport.width);expect(sheet!.y+sheet!.height).toBeGreaterThanOrEqual(viewport.height);
 }
 await transition.evaluate(element=>{for(const animation of element.getAnimations({subtree:true}))animation.finish();});
 await expect(page).toHaveURL(new RegExp(`#knowledge/${entry.id}$`));
 await expect(transition).toBeVisible();await expect(page.locator('.detail-header h1')).toHaveText(entry.name);
 await expect.poll(()=>transition.evaluate(element=>element.getAnimations().length)).toBeGreaterThan(0);
 await transition.evaluate(element=>{for(const animation of element.getAnimations({subtree:true}))animation.finish();});
 await expect(transition).toHaveCount(0);await expect(page.locator('.detail-header h1')).toBeFocused();
});

test('the classic retains concurrent opening and zoom with a shorter total duration',async({page})=>{
 await page.addInitScript(()=>{
  const animate=Element.prototype.animate;
  Element.prototype.animate=function(keyframes,options){const animation=animate.call(this,keyframes,options);if(this.closest('.book-opening'))animation.pause();return animation;};
 });
 await page.goto('/#library');await page.getByRole('button',{name:'阅读 黄帝内经',exact:true}).click();
 const transition=page.getByRole('dialog',{name:'正在翻开《黄帝内经》'});await expect(transition).toBeVisible();
 const duration=await transition.evaluate(element=>Math.max(...element.getAnimations({subtree:true}).map(animation=>{const timing=animation.effect!.getTiming();return Number(timing.delay)+Number(timing.duration);})));
 expect(duration).toBeLessThanOrEqual(2100);
 await transition.evaluate(element=>{for(const animation of element.getAnimations({subtree:true}))animation.finish();});
 await expect(page).toHaveURL(/#knowledge\/classic-huangdi$/);
 await expect.poll(()=>transition.evaluate(element=>element.getAnimations().length)).toBeGreaterThan(0);
 expect(await transition.evaluate(element=>Number(element.getAnimations()[0].effect!.getTiming().duration))).toBeLessThanOrEqual(300);
 await transition.evaluate(element=>{for(const animation of element.getAnimations({subtree:true}))animation.finish();});
 await expect(transition).toHaveCount(0);
});

test('mobile themed entries fit the viewport and reduced motion enters immediately',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#library');
 for(const name of ['桂枝','桂枝汤','足阳明胃经','阴阳','足三里','八纲辨证','张仲景']){
  const card=page.getByRole('button',{name:`阅读 ${name}`,exact:true});await card.scrollIntoViewIfNeeded();
  const bounds=await card.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(390);
  await card.click();await expect(page.locator('.detail-header h1')).toHaveText(name);await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'返回知识库',exact:true}).click();
 }
 expect(await page.locator('.cosmic-content-scroll').evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
});

test('Escape cancels a physician stamp without a late redirect',async({page})=>{
 await page.goto('/#library');const card=page.getByRole('button',{name:'阅读 张仲景',exact:true});await card.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('dialog',{name:'正在打开《张仲景》'})).toBeVisible();await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(card).toBeFocused();await page.waitForTimeout(1600);await expect(page).toHaveURL(/#library$/);
});
