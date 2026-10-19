import {test,expect} from '@playwright/test';

test('the hall navigation opens the double-door game and returns to the cosmos',async({page})=>{
 test.setTimeout(90000);
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/#game');
 await expect(page.getByRole('button',{name:'岐黄堂',exact:true})).toHaveAttribute('aria-current','page');
 const frame=page.frameLocator('iframe[title="岐黄堂 · 急症候 / 行医录"]');
 await expect(frame.locator('#door-chronicle')).toBeVisible({timeout:60000});
 await expect(frame.locator('#door-acute')).toBeVisible();
 await expect(page.locator('.universe-search')).toHaveCount(0);
 await expect(page.locator('.cosmic-footer')).toHaveCount(0);
 await expect(page.locator('.ai-launcher')).toHaveCount(0);
 await page.getByRole('button',{name:'知识图谱',exact:true}).click();
 await expect(page).toHaveURL(/#home$/);
 await expect(page.locator('iframe')).toHaveCount(0);
});
