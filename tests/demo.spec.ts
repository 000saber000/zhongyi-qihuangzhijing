import {test,expect} from '@playwright/test';
test('search, read, bookmark and restore',async({page})=>{
 await page.goto('/');
 await page.getByPlaceholder('搜索经典、本草、方剂与知识…').fill('桂枝汤');
 await page.getByPlaceholder('搜索经典、本草、方剂与知识…').press('Enter');
 await page.getByRole('button',{name:'阅读 桂枝汤',exact:true}).click();
 await expect(page.getByRole('heading',{name:'桂枝汤',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'收藏知识',exact:true}).click();
 await page.reload();
 await page.getByRole('button',{name:'我的书斋',exact:true}).click();
 await expect(page.getByRole('button',{name:'阅读 桂枝汤',exact:true})).toBeVisible();
});
test('empty search and graph relation navigation',async({page})=>{
 await page.goto('/');
 const input=page.getByPlaceholder('搜索经典、本草、方剂与知识…');
 await input.fill('不存在的知识xyz'); await input.press('Enter');
 await expect(page.getByText('暂未找到相关知识')).toBeVisible();
 await page.getByRole('button',{name:'知识图谱',exact:true}).click();
 await input.fill('桂枝汤');await input.press('Enter');await page.getByRole('button',{name:'阅读 桂枝汤',exact:true}).click();
 await expect(page.getByRole('button',{name:'深入研读',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'深入研读',exact:true}).click();
 await expect(page.getByRole('heading',{name:'桂枝汤',exact:true})).toBeVisible();
});
test('mobile fits viewport and lesson completion persists',async({page})=>{
 await page.setViewportSize({width:390,height:844}); await page.goto('/');
 await expect(page.getByRole('heading',{name:'万千医理，皆有星辰。'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'学习路径',exact:true}).click();
 await page.getByRole('button',{name:'开始学习 中医入门：建立知识框架',exact:true}).click();
 await page.getByRole('button',{name:'完成本节学习',exact:true}).click();
 await expect(page.getByRole('dialog').getByText('1 / 5 单元已完成')).toBeVisible();
 await page.reload(); await page.getByRole('button',{name:'学习路径',exact:true}).click();
 await expect(page.getByText('1 / 5 单元已完成')).toBeVisible();
});
test('resume first unfinished lesson after out-of-order completion',async({page})=>{
 await page.goto('/#courses');
 const course=page.getByRole('button',{name:'开始学习 中医入门：建立知识框架',exact:true});
 await course.click();
 await page.getByRole('button',{name:'第2节 五行：在关系中理解万物',exact:true}).click();
 await page.getByRole('button',{name:'完成本节学习',exact:true}).click();
 await page.getByRole('button',{name:'关闭学习单元',exact:true}).click();
 await course.click();
 await page.getByRole('dialog',{name:'阴阳不是二分法',exact:true}).waitFor();
 await expect(page.getByRole('dialog').getByRole('heading',{name:'阴阳不是二分法',exact:true})).toBeVisible();
});
test('immersive universe renders particles and selects searchable knowledge',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'万千医理，皆有星辰。',exact:true})).toBeVisible();
 await expect(page.locator('.universe-stage canvas')).toBeVisible();
 await expect(page.getByText('知识星系已点亮', {exact:true})).toBeVisible();
 const search=page.getByPlaceholder('搜索经典、本草、方剂与知识…');
 await search.fill('桂枝汤');await search.press('Enter');
 await page.getByRole('button',{name:'阅读 桂枝汤',exact:true}).click();
 await expect(page.getByRole('heading',{name:'桂枝汤',exact:true})).toBeVisible();
 await expect(page.getByText('关联星辰', {exact:true})).toBeVisible();
 await page.getByRole('button',{name:'关联知识 桂枝',exact:true}).click();
 await page.getByRole('heading',{name:'桂枝',exact:true}).waitFor();
 await expect(page.getByRole('heading',{name:'桂枝',exact:true})).toBeVisible();
});
test('particle motion can be paused and quality switched',async({page})=>{
 await page.goto('/');await page.locator('.universe-stage[data-ready="true"]').waitFor();
 await page.getByRole('button',{name:'暂停粒子动画',exact:true}).click();
 await expect(page.getByRole('button',{name:'播放粒子动画',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'画质与效果',exact:true}).click();
 await page.getByRole('button',{name:'粒子画质 精细 · 88,500 粒子',exact:true}).click();
 await expect(page.locator('.universe-stage')).toHaveAttribute('data-particles','28000');
 await page.getByRole('button',{name:'关闭效果设置',exact:true}).click();
 await page.getByRole('button',{name:'播放粒子动画',exact:true}).click();
 await expect(page.getByRole('button',{name:'暂停粒子动画',exact:true})).toBeVisible();
});
test('unsupported fullscreen shows a notice without an exception',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(Element.prototype,'requestFullscreen',{value:undefined,configurable:true}));
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'全屏星系',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('当前浏览器不支持全屏');
 expect(errors).toEqual([]);
});
test('focused star remains centered while the galaxy rotates',async({page})=>{
 await page.goto('/#universe/formula-guizhi');
 await page.locator('.universe-stage[data-ready="true"]').waitFor();
 const label=page.locator('.star-label.chosen');await expect(label).toBeVisible();
 await page.waitForTimeout(6000);const before=await label.boundingBox();
 await page.waitForTimeout(6000);const after=await label.boundingBox();
 expect(before).not.toBeNull();expect(after).not.toBeNull();
 expect(Math.hypot(after!.x-before!.x,after!.y-before!.y)).toBeLessThan(6);
});
test('all sections keep the same cosmos shell and canvas',async({page})=>{
 await page.goto('/');await page.locator('.universe-stage[data-ready="true"]').waitFor();
 await page.locator('.universe-stage canvas').evaluate(c=>c.setAttribute('data-persist-check','same-canvas'));
 await page.getByRole('button',{name:'暂停粒子动画',exact:true}).click();
 for(const section of ['知识库','学习路径','我的书斋']){
  await page.getByRole('button',{name:section,exact:true}).click();
  await expect(page.locator('.universe-header')).toBeVisible();
  await expect(page.locator('.universe')).toHaveClass(/content-mode/);
  await expect(page.locator('.universe-stage canvas')).toHaveAttribute('data-persist-check','same-canvas');
  await expect(page.getByRole('button',{name:section,exact:true})).toHaveAttribute('aria-current','page');
  expect(await page.locator('.course-choice-glow,.knowledge-card,.empty').first().evaluate(e=>getComputedStyle(e).backgroundColor)).not.toBe('rgb(251, 250, 246)');
 }
 await page.getByRole('button',{name:'知识图谱',exact:true}).click();
 await expect(page.getByRole('heading',{name:'万千医理，皆有星辰。'})).toBeVisible();
 await expect(page.locator('.universe-stage canvas')).toHaveAttribute('data-persist-check','same-canvas');
 await expect(page.getByRole('button',{name:'播放粒子动画',exact:true})).toBeVisible();
});
test('mobile content search and detail retain layout and shell',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/#courses');
 await page.waitForTimeout(500);
 const title=await page.locator('.page-title').boundingBox(),searchBox=await page.locator('.universe-search').boundingBox();
 expect(title!.y).toBeGreaterThanOrEqual(searchBox!.y+searchBox!.height);
 const search=page.getByPlaceholder('搜索经典、本草、方剂与知识…');
 await search.fill('桂枝汤');await search.press('Enter');
 await page.getByRole('button',{name:'阅读 桂枝汤',exact:true}).click();
 await expect(page.getByRole('heading',{name:'桂枝汤',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'知识库',exact:true})).toHaveAttribute('aria-current','page');
 expect(await page.locator('.cosmic-content-scroll').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 for(const label of ['学习路径','我的书斋','知识库']){
  await page.getByRole('button',{name:label,exact:true}).click();
  expect(await page.locator('.cosmic-content-scroll').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 }
});
test('browser back closes an open lesson',async({page})=>{
 await page.goto('/#library');await page.getByRole('button',{name:'学习路径',exact:true}).click();
 await page.getByRole('button',{name:'开始学习 中医入门：建立知识框架',exact:true}).click();
 await page.getByRole('dialog',{name:'阴阳不是二分法',exact:true}).waitFor();
 await expect(page.getByRole('dialog',{name:'阴阳不是二分法',exact:true})).toBeVisible();await page.goBack();
 await expect(page.getByRole('heading',{name:'知识库',exact:true})).toBeVisible();
 await expect(page.getByRole('dialog')).toHaveCount(0);
});
