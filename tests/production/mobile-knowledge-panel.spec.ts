import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

for(const viewport of [{width:390,height:630},{width:390,height:520},{width:320,height:640}]){
 test(`mobile knowledge stays below search without dynamic viewport units at ${viewport.width}x${viewport.height}`,async({page})=>{
  await page.setViewportSize(viewport);
  const items=JSON.parse(await readFile(new URL('../../src/data/knowledge.json',import.meta.url),'utf8'));
  await page.route('**/api/knowledge',route=>route.fulfill({json:{items}}));
  await page.goto('/#universe/person-zhangzhongjing');
  const panel=page.getByRole('complementary',{name:'知识详情'});
  await expect(panel.getByRole('heading',{name:'张仲景',exact:true})).toBeVisible();
  // Older mobile engines discard declarations using dvh. Exercise the resulting
  // cascade in the real browser rather than assuming modern viewport support.
  await page.evaluate(()=>{
   function discardUnsupported(rules:CSSRuleList){
    for(const rule of rules){
     if(rule instanceof CSSStyleRule)for(const property of Array.from(rule.style)){
      if(rule.style.getPropertyValue(property).includes('dvh'))rule.style.removeProperty(property);
     }
     if('cssRules' in rule)discardUnsupported((rule as CSSGroupingRule).cssRules);
    }
   }
   for(const sheet of Array.from(document.styleSheets))discardUnsupported(sheet.cssRules);
  });
  const bounds=(await panel.boundingBox())!,search=(await page.locator('.universe-search').boundingBox())!,controls=(await page.locator('.cosmic-controls').boundingBox())!;
  expect(bounds.y,'knowledge header must stay below search').toBeGreaterThanOrEqual(search.y+search.height+8);
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds.y+bounds.height).toBeLessThanOrEqual(controls.y);
  const close=panel.getByRole('button',{name:'关闭知识详情',exact:true});
  await expect(close).toBeInViewport({ratio:1});
  await expect(close).toBeEnabled();
  expect(await close.evaluate(button=>{
   const r=button.getBoundingClientRect();return button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
  })).toBe(true);
  await panel.evaluate(element=>{element.scrollTop=element.scrollHeight;});
  await expect(panel.getByRole('button',{name:'深入研读',exact:true})).toBeInViewport({ratio:1});
  await panel.getByRole('button',{name:'关联知识 桂枝汤',exact:true}).click();
  await expect(panel.getByRole('heading',{name:'桂枝汤',exact:true})).toBeInViewport({ratio:1});
  expect(await panel.evaluate(element=>element.scrollTop)).toBe(0);
  await panel.getByRole('button',{name:'深入研读',exact:true}).click();
  await expect(page).toHaveURL(/#knowledge\/formula-guizhi$/);
  await page.goBack();
  await expect(panel.getByRole('heading',{name:'桂枝汤',exact:true})).toBeInViewport({ratio:1});
  await close.click();
  await expect(panel).toBeHidden();
 });
}
