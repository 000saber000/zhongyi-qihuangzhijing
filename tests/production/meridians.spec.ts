import {test,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:15000});
import {readFile} from 'node:fs/promises';
test('packaged paired models, point camera and three licenses work in both outputs',async({page,request})=>{
 const items=JSON.parse(await readFile(new URL('../../src/data/knowledge.json',import.meta.url),'utf8'));
 await page.route('**/api/knowledge',route=>route.fulfill({json:{items}}));
 const bad:string[]=[];page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)bad.push(r.url());});
 await page.goto('/#library');await expect(page.getByRole('heading',{name:'知识库',exact:true})).toBeVisible();
 expect((await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name))).some(url=>url.endsWith('.glb'))).toBe(false);
 await page.getByRole('button',{name:'经络云图',exact:true}).click();await expect(page.getByTestId('body-scene')).toHaveAttribute('data-status','ready');await expect(page.locator('canvas')).toHaveCount(1);
 await page.getByRole('button',{name:'展开穴位目录'}).click();await page.getByRole('button',{name:'选择 足三里 ST36'}).click();
 await page.getByRole('button',{name:'女性人体',exact:true}).click();await expect(page.getByTestId('body-scene')).toHaveAttribute('data-status','ready');await expect(page.getByTestId('body-scene')).toHaveAttribute('data-focus','point-zusanli:left');
 await Promise.all([page.waitForResponse(r=>r.url().includes('viscera')&&r.url().includes('.glb')&&r.ok()),page.getByRole('switch',{name:'人体透视'}).click()]);
 await expect(page.getByRole('checkbox',{name:'内脏'})).toBeChecked();await expect(page.getByRole('checkbox',{name:'经脉'})).toBeChecked();await expect(page.getByRole('slider',{name:'人体透明度'})).toHaveValue('25');
 await page.getByRole('switch',{name:'人体透视'}).click();
 expect(bad).toEqual([]);
 for(const path of ['/licenses/mpfb-CC0.txt','/licenses/shiyun-MIT.txt','/licenses/react-bits.txt','/licenses/lux3d-models.txt']){const response=await request.get(path);expect(response.ok()).toBe(true);expect(response.headers()['content-type']).not.toContain('text/html');}
 await page.getByRole('button',{name:'展开穴位介绍'}).click();await page.getByRole('button',{name:'阅读完整穴位知识'}).click();await expect(page.getByRole('heading',{name:'足三里',exact:true})).toBeVisible();await expect(page.getByTestId('body-scene')).toHaveCount(0);
});
