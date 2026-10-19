import {test,expect} from '@playwright/test';

test('the hall navigation opens the full-screen double-door game and returns home',async({page})=>{
 test.setTimeout(90000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/#home');
 await page.getByRole('button',{name:'岐黄堂',exact:true}).click();
 await expect(page).toHaveURL(/#game$/);
 await expect(page.getByRole('navigation',{name:'主导航'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'返回知识宇宙'})).toBeVisible();
 const frame=page.frameLocator('iframe[title="岐黄堂 · 急症候 / 行医录"]');
 await expect(frame.locator('#door-chronicle')).toBeVisible({timeout:60000});
 await expect(frame.locator('#door-acute')).toBeVisible();
 await frame.locator('body.models-exterior-ready').waitFor({state:'attached',timeout:60000});
 await expect(page.locator('.universe-search')).toHaveCount(0);
 await expect(page.locator('.cosmic-footer')).toHaveCount(0);
 await expect(page.locator('.ai-launcher')).toHaveCount(0);
 await page.getByRole('button',{name:'返回知识宇宙'}).click();
 await expect(page).toHaveURL(/#home$/);
 await expect(page.getByRole('navigation',{name:'主导航'})).toBeVisible({timeout:15000});
 await expect(page.locator('iframe')).toHaveCount(0);
});
