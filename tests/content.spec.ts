import {test,expect} from '@playwright/test';
test.use({reducedMotion:'reduce',viewport:{width:390,height:844}});
test('the universe shows a content sync failure and allows retry',async({page})=>{
 await page.route('**/api/knowledge',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'UNAVAILABLE',message:'unavailable'}})}));
 await page.goto('/');
 await expect(page.getByRole('button',{name:'重试同步内容',exact:true})).toBeVisible();
 await page.unroute('**/api/knowledge');
 await page.getByRole('button',{name:'重试同步内容',exact:true}).click();
 await expect(page.getByRole('button',{name:'重试同步内容',exact:true})).toHaveCount(0);
});
test('catalog sync preserves default detail and lesson guidance',async({page})=>{
 const loaded=page.waitForResponse(response=>response.url().endsWith('/api/knowledge'));
 await page.goto('/#knowledge/classic-shanghan');await loaded;
 await expect(page.getByText('先辨识本条目的核心概念，再结合来源说明与相关条目理解其语境。',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'学习路径',exact:true}).click();
 await page.getByRole('button',{name:'开始学习 中医入门：建立知识框架',exact:true}).click();
 await page.getByRole('button',{name:'第3节 藏象与人体功能网络',exact:true}).click();
 await expect(page.getByText('理解概念在经典和教材中的语境。',{exact:true})).toBeVisible();
});
