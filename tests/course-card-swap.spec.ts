import {test,expect} from '@playwright/test';

test('desktop puts the generated course card stack beside the original nebula',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/#courses');
 const deck=page.getByRole('region',{name:'课程卡片轮播',exact:true});
 await expect(deck).toBeVisible();
 const scene=await page.locator('.course-orbit-scene').boundingBox(),cards=await deck.boundingBox();
 expect(scene!.x+scene!.width).toBeLessThanOrEqual(cards!.x+2);
 await expect(deck.locator('.course-choice-glow')).toHaveCount(3);
 await expect(deck.locator('img')).toHaveCount(3);
 for(const image of await deck.locator('img').all())await expect.poll(()=>image.evaluate(element=>(element as HTMLImageElement).complete&&(element as HTMLImageElement).naturalWidth>100)).toBe(true);
 await expect(deck.locator('[data-front]')).toHaveAttribute('data-swap-index','0');
 await page.getByRole('button',{name:'下一门课程',exact:true}).click();
 await expect(deck.locator('[data-front]')).toHaveAttribute('data-swap-index','1');
 await page.getByRole('button',{name:'上一门课程',exact:true}).click();
 await expect(deck.locator('[data-front]')).toHaveAttribute('data-swap-index','0');
});

test('keyboard and reduced motion keep the deck usable and course progress persists',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#courses');
 const deck=page.getByRole('region',{name:'课程卡片轮播',exact:true});
 await expect(deck).toBeVisible();await deck.focus();await deck.press('ArrowRight');
 await expect(deck.locator('[data-front]')).toHaveAttribute('data-swap-index','1');
 await deck.press('ArrowLeft');await expect(deck.locator('[data-front]')).toHaveAttribute('data-swap-index','0');
 const start=page.getByRole('button',{name:'开始学习 中医入门：建立知识框架',exact:true});
 await start.click();await page.getByRole('button',{name:'完成本节学习',exact:true}).click();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(start).toBeFocused();
 await expect(deck.getByText('1 / 5 单元已完成',{exact:true})).toBeVisible();
 await page.reload();await expect(deck.getByText('1 / 5 单元已完成',{exact:true})).toBeVisible();
});

test('phone stacks the scene above the cards without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#courses');
 const deck=page.getByRole('region',{name:'课程卡片轮播',exact:true});await expect(deck).toBeVisible();
 const scene=await page.locator('.course-orbit-scene').boundingBox(),cards=await deck.boundingBox();
 expect(scene!.y+scene!.height).toBeLessThanOrEqual(cards!.y+2);
 expect(cards!.x).toBeGreaterThanOrEqual(0);expect(cards!.x+cards!.width).toBeLessThanOrEqual(390);
 await page.getByRole('button',{name:'下一门课程',exact:true}).click();await expect(deck.locator('[data-front]')).toHaveAttribute('data-swap-index','1');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('dragging changes the course without opening a lesson and routes remount cleanly',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:1000});await page.goto('/#courses');
 const deck=page.getByRole('region',{name:'课程卡片轮播',exact:true});
 const image=deck.locator('[data-front] img');await expect(image).toBeVisible();
 await expect.poll(()=>image.evaluate(element=>(element as HTMLImageElement).complete)).toBe(true);
 const box=(await image.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 await page.mouse.move(box.x+box.width/2+240,box.y+box.height/2,{steps:12});await page.mouse.up();
 await expect(deck.locator('[data-front]')).toHaveAttribute('data-swap-index','1');await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'知识库',exact:true}).click();await page.getByRole('button',{name:'学习路径',exact:true}).click();
 await expect(deck.locator('[data-front]')).toHaveAttribute('data-swap-index','0');expect(errors).toEqual([]);
});

test('focused controls pause autoplay and live reduced motion keeps card changes immediate',async({page})=>{
 await page.goto('/#courses');const deck=page.getByRole('region',{name:'课程卡片轮播',exact:true});
 await deck.focus();await page.waitForTimeout(6800);await expect(deck.locator('[data-front]')).toHaveAttribute('data-swap-index','0');
 await page.emulateMedia({reducedMotion:'reduce'});await deck.press('ArrowRight');
 await expect(deck.locator('[data-front]')).toHaveAttribute('data-swap-index','1');
 const before=await deck.locator('[data-front]').getAttribute('style');await page.waitForTimeout(250);
 expect(await deck.locator('[data-front]').getAttribute('style')).toBe(before);
});

test('enabling reduced motion cancels a drag already in progress',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/#courses');
 const deck=page.getByRole('region',{name:'课程卡片轮播',exact:true});
 const front=deck.locator('[data-front]');await expect(front).toBeVisible();
 const box=(await front.locator('img').boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+60,y,{steps:6});
 await expect(front).toHaveCSS('cursor','grabbing');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(front).not.toHaveCSS('cursor','grabbing');
 const before=await front.getAttribute('style');await page.mouse.move(x+160,y,{steps:6});
 expect(await front.getAttribute('style')).toBe(before);
 await page.mouse.up();await expect(deck.locator('[data-front]')).toHaveAttribute('data-swap-index','0');
 await expect(page.getByRole('dialog')).toHaveCount(0);
});
