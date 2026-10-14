import {test,expect} from '@playwright/test';
import type {Locator} from '@playwright/test';

// Pause the real browser animation so completion, rather than a fixed timeout,
// controls the assertions about retained content and interrupted navigation.
async function pauseNextAnimation(element:Locator){
 await element.evaluate(element=>{
  const animate=element.animate.bind(element);
  element.animate=(frames,options)=>{const animation=animate(frames,options);animation.pause();return animation;};
 });
}
async function finishAnimation(element:Locator){
 await element.evaluate(element=>{
  delete (element as HTMLElement & {animate?:HTMLElement['animate']}).animate;
  element.getAnimations()[0].finish();
 });
}

test('switching stars fades content within the same panel and keeps the canvas',async({page})=>{
 await page.goto('/#universe/formula-guizhi');
 const panel=page.getByRole('complementary',{name:'知识详情'});
 await expect(panel.getByRole('heading',{name:'桂枝汤',exact:true})).toBeVisible();
 await panel.evaluate(element=>Promise.all(element.getAnimations({subtree:true}).map(animation=>animation.finished)));
 await page.locator('.universe-stage canvas').evaluate(element=>{element.dataset.testInstance='original';});
 const position=await panel.boundingBox();
 const content=panel.locator('.panel-content');
 await pauseNextAnimation(content);
 await panel.getByRole('button',{name:'关联知识 桂枝',exact:true}).click();
 await expect(page).toHaveURL(/#universe\/herb-guizhi$/);
 await expect(panel.getByRole('heading',{name:'桂枝汤',exact:true})).toBeVisible();
 await expect.poll(()=>content.evaluate(element=>element.getAnimations().length)).toBe(1);
 expect(await panel.boundingBox()).toMatchObject({x:position!.x,y:position!.y,width:position!.width});
 await finishAnimation(content);
 await expect(panel.getByRole('heading',{name:'桂枝',exact:true})).toBeVisible();
 await expect(page.locator('.universe-stage canvas')).toHaveAttribute('data-test-instance','original');
 await panel.getByRole('button',{name:'收藏知识',exact:true}).click();
 await expect(panel.getByRole('button',{name:'取消收藏',exact:true})).toBeVisible();
});

test('closing finishes its fade before hiding and cannot erase a newer selection',async({page})=>{
 await page.goto('/#universe/herb-guizhi');
 const panel=page.locator('.cosmic-panel');
 await expect(panel.getByRole('heading',{name:'桂枝',exact:true})).toBeVisible();
 await panel.evaluate(element=>Promise.all(element.getAnimations({subtree:true}).map(animation=>animation.finished)));
 await pauseNextAnimation(panel);
 await page.getByRole('button',{name:'关闭知识详情',exact:true}).click();
 await expect(page).toHaveURL(/#home$/);
 await expect(panel).toBeVisible();
 await expect.poll(()=>panel.evaluate(element=>element.getAnimations().length)).toBe(1);
 await expect(panel).toHaveAttribute('inert','');
 await page.evaluate(()=>{location.hash='universe/classic-huangdi';});
 await expect(page.getByRole('heading',{name:'黄帝内经',exact:true})).toBeVisible();
 await panel.evaluate(element=>{delete (element as HTMLElement & {animate?:HTMLElement['animate']}).animate;});
 await page.getByRole('button',{name:'关闭知识详情',exact:true}).click();
 await expect(panel).toBeHidden();
 await page.goBack();
 await expect(page.getByRole('heading',{name:'黄帝内经',exact:true})).toBeVisible();
});

test('enabling reduced motion completes a pending fade immediately',async({page})=>{
 await page.goto('/#universe/herb-guizhi');
 const panel=page.locator('.cosmic-panel');
 await expect(panel.getByRole('heading',{name:'桂枝',exact:true})).toBeVisible();
 await panel.evaluate(element=>Promise.all(element.getAnimations({subtree:true}).map(animation=>animation.finished)));
 await pauseNextAnimation(panel);
 await page.getByRole('button',{name:'关闭知识详情',exact:true}).click();
 await expect(panel).toBeVisible();
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(panel).toBeHidden();
 await page.evaluate(()=>{location.hash='universe/classic-huangdi';});
 await expect(page.getByRole('heading',{name:'黄帝内经',exact:true})).toBeVisible();
 expect(await panel.evaluate(element=>element.getAnimations({subtree:true}).length)).toBe(0);
});

test('mobile deep reading and browser back retain the universe and selected knowledge',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/#universe/formula-guizhi');
 await expect(page.getByRole('heading',{name:'桂枝汤',exact:true})).toBeVisible();
 await page.locator('.universe-stage canvas').evaluate(element=>{element.dataset.testInstance='original';});
 await page.getByRole('button',{name:'深入研读',exact:true}).click();
 await expect(page).toHaveURL(/#knowledge\/formula-guizhi$/);
 await expect(page.locator('.detail-header').getByRole('heading',{name:'桂枝汤',exact:true})).toBeVisible();
 expect(await page.locator('.cosmic-content-scroll').evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
 await expect(page.locator('.universe-stage canvas')).toHaveAttribute('data-test-instance','original');
 await page.goBack();
 await expect(page).toHaveURL(/#universe\/formula-guizhi$/);
 await expect(page.getByRole('complementary',{name:'知识详情'}).getByRole('heading',{name:'桂枝汤',exact:true})).toBeVisible();
 await expect(page.locator('.universe-stage canvas')).toHaveAttribute('data-test-instance','original');
});
