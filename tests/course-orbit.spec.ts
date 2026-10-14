import {test,expect} from '@playwright/test';

test('three bound books orbit a miniature nebula and can be held for selection',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/#courses');
 const scene=page.getByRole('region',{name:'古籍环绕学习路径'});
 await scene.locator('.course-3d-slot canvas[data-ready="true"]').waitFor();
 await expect(scene.locator('.course-3d-slot canvas')).toBeVisible();
 expect(await scene.locator('canvas').evaluate(element=>!!(element as HTMLCanvasElement).getContext('webgl2'))).toBe(true);
 expect(await scene.locator('canvas').evaluate(element=>Number((element as HTMLElement).dataset.triangles))).toBeGreaterThan(1000);
 await expect(scene.getByRole('button',{name:/^翻开 /})).toHaveCount(3);
 await expect(scene).toHaveAttribute('data-motion','running');
 await scene.getByRole('button',{name:'暂停古籍公转',exact:true}).click();
 await expect(scene).toHaveAttribute('data-motion','paused');
 const book=scene.getByRole('button',{name:'翻开 中医入门：建立知识框架',exact:true});
 const before=await book.boundingBox();await page.waitForTimeout(250);
 expect(await book.boundingBox()).toEqual(before);
 await scene.getByRole('button',{name:'继续古籍公转',exact:true}).click();
 await page.mouse.move(10,10);
 await expect(scene).toHaveAttribute('data-motion','running');
 await expect.poll(async()=>Math.abs((await book.boundingBox())!.x-before!.x)+Math.abs((await book.boundingBox())!.y-before!.y)).toBeGreaterThan(1);
});

test('hover and keyboard focus stop the orbit and opening retains its real animation handoff',async({page})=>{
 await page.addInitScript(()=>{
  const animate=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){const animation=animate.call(this,frames,options);if(this.closest('.course-opening'))animation.pause();return animation;};
 });
 await page.setViewportSize({width:1440,height:1000});await page.goto('/#courses');
 const scene=page.getByRole('region',{name:'古籍环绕学习路径'});
 await scene.locator('.course-3d-slot canvas[data-ready="true"]').waitFor();
 await scene.locator('canvas').evaluate(element=>{(element as HTMLElement).dataset.courseInstance='same-course-canvas';});
 const book=scene.getByRole('button',{name:'翻开 中医入门：建立知识框架',exact:true});
 const box=await book.boundingBox();await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
 await expect(scene).toHaveAttribute('data-motion','paused');
 await page.mouse.move(10,10);await book.focus();
 await expect(scene).toHaveAttribute('data-motion','paused');
 await book.press('Enter');
 const opening=page.getByRole('dialog',{name:'正在翻开课程《中医入门》',exact:true});
 await expect(opening).toBeVisible();
 await expect(opening.locator('canvas')).toHaveAttribute('data-course-instance','same-course-canvas');
 await expect(page.locator('canvas')).toHaveCount(2);
 await expect(page).toHaveURL(/#courses$/);
 await expect.poll(()=>opening.evaluate(element=>element.getAnimations({subtree:true}).length)).toBeGreaterThan(0);
 await opening.evaluate(element=>{for(const animation of element.getAnimations({subtree:true}))animation.finish();});
 await expect.poll(()=>opening.evaluate(element=>element.getAnimations().length)).toBeGreaterThan(0);
 await opening.evaluate(element=>{for(const animation of element.getAnimations({subtree:true}))animation.finish();});
 await expect(opening).toHaveCount(0);
 await expect(scene.locator('canvas')).toHaveAttribute('data-course-instance','same-course-canvas');
 await expect(page.getByRole('dialog').getByRole('heading',{name:'阴阳不是二分法',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await page.locator('.course-lesson-modal[inert]').waitFor();
 await page.locator('.course-lesson-modal').evaluate(element=>element.getAnimations().forEach(animation=>animation.finish()));
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(book).toBeFocused();
 await expect(scene).toHaveAttribute('data-motion','paused');
 await book.press('Enter');await expect(opening).toBeVisible();
 await page.keyboard.press('Escape');await expect(opening).toHaveCount(0);
 await expect(book).toBeFocused();
 await expect(scene).toHaveAttribute('data-motion','paused');
});

test('Escape cancels a pending opening and route changes cannot open a delayed lesson',async({page})=>{
 await page.addInitScript(()=>{
  const animate=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){const animation=animate.call(this,frames,options);if(this.closest('.course-opening'))animation.pause();return animation;};
 });
 await page.goto('/#courses');
 const start=page.getByRole('button',{name:'开始学习 中医入门：建立知识框架',exact:true});
 await page.locator('.course-3d-slot canvas[data-ready="true"]').waitFor();
 await start.click();await expect(page.getByRole('dialog',{name:'正在翻开课程《中医入门》',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await start.click();await page.evaluate(()=>{location.hash='library';});
 await expect(page.getByRole('heading',{name:'知识库',exact:true})).toBeVisible();
 await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('mobile reduced motion enters directly, records real progress and restores it after reload',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});
 await page.goto('/#courses');
 const scene=page.getByRole('region',{name:'古籍环绕学习路径'});
 await expect(scene).toHaveAttribute('data-motion','paused');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'开始学习 中医入门：建立知识框架',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'正在翻开课程《中医入门》',exact:true})).toHaveCount(0);
 const lesson=page.getByRole('dialog');
 await lesson.getByRole('button',{name:'完成本节学习',exact:true}).click();
 await expect(lesson.getByText('1 / 5 单元已完成',{exact:true})).toBeVisible();
 await lesson.getByRole('button',{name:'关闭学习单元',exact:true}).click();
 await expect(lesson).toHaveCount(0);
 await expect(scene.getByText('1 / 5 单元已完成',{exact:true})).toBeVisible();
 await page.reload();await expect(scene.getByText('1 / 5 单元已完成',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'开始学习 中医入门：建立知识框架',exact:true}).click();
 await expect(page.getByRole('dialog').getByRole('heading',{name:'五行：在关系中理解万物',exact:true})).toBeVisible();
});

test('navigation leaves the original universe canvas and controls intact',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 await page.locator('.universe-stage[data-ready="true"]').waitFor();
 await page.locator('.universe-stage canvas').evaluate(element=>{element.dataset.orbitCheck='original';});
 await page.getByRole('button',{name:'学习路径',exact:true}).click();
 await expect(page.getByRole('region',{name:'古籍环绕学习路径'})).toBeVisible();
 await expect(page.locator('.universe-stage canvas')).toHaveCount(1);
 await expect(page.locator('.universe-stage canvas')).toHaveAttribute('data-orbit-check','original');
 await page.getByRole('button',{name:'知识图谱',exact:true}).click();
 await expect(page.locator('.universe-stage canvas')).toHaveAttribute('data-orbit-check','original');
 await expect(page.getByRole('button',{name:'放大星系',exact:true})).toBeVisible();
});


test('right-hinged 3D cover swings outward clear of the paper block',async({page})=>{
 await page.addInitScript(()=>{const animate=Element.prototype.animate;Element.prototype.animate=function(frames,options){const animation=animate.call(this,frames,options);if(this.closest('.course-opening'))animation.pause();return animation;};});
 await page.goto('/#courses');await page.locator('.course-3d-slot canvas[data-ready="true"]').waitFor();
 await page.getByRole('button',{name:'开始学习 中医入门：建立知识框架',exact:true}).click();
 const opening=page.locator('.course-opening');await expect(opening).toBeVisible();
 await opening.locator('.course-opening-stage').evaluate(element=>element.getAnimations().forEach(animation=>{animation.currentTime=400;}));
 await expect.poll(()=>opening.locator('canvas').evaluate(element=>Number((element as HTMLElement).dataset.coverTime))).toBe(400);
 expect(await opening.locator('canvas').evaluate(element=>Number((element as HTMLElement).dataset.coverCenterDepth))).toBeGreaterThan(.14);
 await page.keyboard.press('Escape');await expect(opening).toHaveCount(0);
});

test('keyboard activation from a fixed course selector restores that selector on close',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#courses');
 await page.locator('.course-3d-slot canvas[data-ready="true"]').waitFor();
 const selector=page.getByRole('button',{name:'开始学习 中医入门：建立知识框架',exact:true});
 await selector.focus();await selector.press('Enter');
 await expect(page.getByRole('dialog').getByRole('heading',{name:'阴阳不是二分法',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(selector).toBeFocused();
});


test('unpaused 3D opening and lesson close complete without manual clock intervention',async({page})=>{
 await page.goto('/#courses');await page.locator('.course-3d-slot canvas[data-ready="true"]').waitFor();
 const selector=page.getByRole('button',{name:'开始学习 中医入门：建立知识框架',exact:true});
 await selector.click();await page.locator('.course-opening').waitFor({state:'detached'});
 await expect(page.getByRole('dialog').getByRole('heading',{name:'阴阳不是二分法',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');await page.locator('.course-lesson-modal').waitFor({state:'detached'});
 await expect(selector).toBeFocused();
});

test('a lost course WebGL context keeps fixed selectors and lesson progress usable',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#courses');
 const canvas=page.locator('.course-3d-slot canvas[data-ready="true"]');await canvas.waitFor();
 await canvas.evaluate(element=>(element as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
 await expect(page.getByText('当前设备无法显示三维古籍，可从下方选择课程继续学习。',{exact:true})).toBeVisible();
 await expect(page.locator('.course-3d-slot canvas')).toHaveCount(0);
 await page.getByRole('button',{name:'开始学习 中医入门：建立知识框架',exact:true}).click();
 await page.getByRole('button',{name:'完成本节学习',exact:true}).click();
 await expect(page.getByRole('dialog').getByText('1 / 5 单元已完成',{exact:true})).toBeVisible();
});

test('live reduced motion safely finishes a paused 3D opening and releases its dialog',async({page})=>{
 await page.addInitScript(()=>{const animate=Element.prototype.animate;Element.prototype.animate=function(frames,options){const animation=animate.call(this,frames,options);if(this.closest('.course-opening'))animation.pause();return animation;};});
 await page.goto('/#courses');await page.locator('.course-3d-slot canvas[data-ready="true"]').waitFor();
 await page.getByRole('button',{name:'开始学习 中医入门：建立知识框架',exact:true}).click();
 await expect(page.locator('.course-opening')).toBeVisible();await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('.course-opening').waitFor({state:'detached'});
 await expect(page.locator('.course-opening')).toHaveCount(0);
 await expect(page.getByRole('dialog').getByRole('heading',{name:'阴阳不是二分法',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByRole('region',{name:'古籍环绕学习路径'})).toHaveAttribute('data-motion','paused');
});

test('restored keyboard selection pauses even when rendering frames are suspended',async({page})=>{
 await page.goto('/#courses');await page.locator('.course-3d-slot canvas[data-ready="true"]').waitFor();
 const selector=page.getByRole('button',{name:'开始学习 中医入门：建立知识框架',exact:true});
 await selector.click();await page.locator('.course-opening').waitFor({state:'detached'});
 await expect(page.getByRole('dialog').getByRole('heading',{name:'阴阳不是二分法',exact:true})).toBeVisible();
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};});
 await page.keyboard.press('Escape');await page.locator('.course-lesson-modal').waitFor({state:'detached'});
 await expect(selector).toBeFocused();
 expect(await selector.evaluate(element=>element.matches(':focus-visible'))).toBe(true);
 await expect(page.getByRole('region',{name:'古籍环绕学习路径'})).toHaveAttribute('data-motion','paused');
});

test('context loss halfway through opening releases the modal and preserves the lesson',async({page})=>{
 await page.addInitScript(()=>{const animate=Element.prototype.animate;Element.prototype.animate=function(frames,options){const animation=animate.call(this,frames,options);if(this.closest('.course-opening'))animation.pause();return animation;};});
 await page.goto('/#courses');await page.locator('.course-3d-slot canvas[data-ready="true"]').waitFor();
 await page.getByRole('button',{name:'开始学习 中医入门：建立知识框架',exact:true}).click();
 const opening=page.locator('.course-opening');await expect(opening).toBeVisible();
 await opening.locator('canvas').evaluate(element=>(element as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
 await expect(opening).toHaveCount(0);
 await expect(page.getByRole('dialog').getByRole('heading',{name:'阴阳不是二分法',exact:true})).toBeVisible();
 await page.emulateMedia({reducedMotion:'reduce'});await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByText('当前设备无法显示三维古籍，可从下方选择课程继续学习。',{exact:true})).toBeVisible();
});
