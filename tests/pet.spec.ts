import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.route('**/api/**',route=>route.fulfill({status:503,json:{error:{code:'OFFLINE_TEST',message:'offline'}}}));
});

test('pet adapts to the current topic, fills a contextual prompt and can be hidden and restored',async({page})=>{
 await page.goto('/#knowledge/theory-yinyang');const pet=page.getByLabel('小岐学习桌宠');
 await expect(pet).toBeVisible();await expect(pet.getByText('正在读《阴阳》？我可以陪你理清重点。',{exact:true})).toBeVisible();
 await pet.getByRole('button',{name:'请用一个生活中的例子解释“阴阳”',exact:true}).click();const dialog=page.getByRole('dialog',{name:'岐黄学习助手'});
 await expect(dialog.getByText('正在讨论：阴阳',{exact:true})).toBeVisible();await expect(dialog.getByLabel('向岐黄提问',{exact:true})).toHaveValue('请用一个生活中的例子解释“阴阳”');
 await dialog.getByLabel('关闭学习助手',{exact:true}).click();await pet.getByRole('button',{name:'暂时隐藏小岐桌宠',exact:true}).click();
 await expect(pet).toHaveCount(0);await page.getByRole('button',{name:'唤回小岐桌宠',exact:true}).click();await expect(page.getByLabel('小岐学习桌宠')).toBeVisible();
});

test('pet changes its guidance by page and stays compact on mobile',async({page})=>{
 await page.goto('/#meridians');const pet=page.getByLabel('小岐学习桌宠');
 await expect(pet.getByText('经脉与穴位很多，先从一条循行路线开始会更清楚。',{exact:true})).toBeVisible();
 await page.goto('/#courses');await expect(pet.getByText('循序而学比一次记很多更有效。我可以帮你选择起点。',{exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});const box=await pet.boundingBox();expect(box).not.toBeNull();expect(box!.x+box!.width).toBeLessThanOrEqual(390);
});
