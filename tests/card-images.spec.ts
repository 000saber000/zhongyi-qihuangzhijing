import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync(new URL('../src/data/knowledge.json',import.meta.url),'utf8'));
test.beforeEach(async({page})=>{await page.route('**/api/knowledge',route=>route.fulfill({json:{items:catalog}}));});
test('the original yin-yang picture fills the central jade disc on desktop and mobile',async({page})=>{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});await page.goto('/#library');
  const card=page.getByRole('button',{name:'阅读 阴阳',exact:true}),disc=card.locator('.jade-disc');
  const image=disc.locator('.card-illustration img');await expect(image).toBeVisible();
  await expect.poll(()=>image.evaluate(image=>(image as HTMLImageElement).naturalWidth)).toBeGreaterThan(100);
  const circle=await disc.boundingBox(),picture=await image.boundingBox();
  expect(picture!.width/circle!.width).toBeGreaterThan(.55);
  expect(Math.abs(picture!.x+picture!.width/2-(circle!.x+circle!.width/2))).toBeLessThan(2);
  expect(Math.abs(picture!.y+picture!.height/2-(circle!.y+circle!.height/2))).toBeLessThan(2);
  await expect(card.locator('.theory-medallion')).toHaveCount(0);
 }
});
test('every catalog entry renders a corresponding dedicated illustration with a decodable source',async({page})=>{
 await page.goto('/#library');await expect(page.locator('.library-grid .knowledge-card')).toHaveCount(catalog.length);
 const assignments=await page.locator('.library-grid .knowledge-card').evaluateAll(cards=>cards.map(card=>({
  name:card.getAttribute('aria-label'),pictures:Array.from(card.querySelectorAll('[data-image-id][data-image-src]')).map(image=>({id:image.getAttribute('data-image-id'),src:image.getAttribute('data-image-src'),cell:image.getAttribute('data-image-cell')??'single'}))
 })));
 for(const item of catalog){const card=assignments.find(card=>card.name===`阅读 ${item.title}`);expect(card?.pictures.some(image=>image.id===item.id),item.id).toBe(true);}
 const matches=catalog.map(item=>assignments.find(card=>card.name===`阅读 ${item.title}`)!.pictures.find(image=>image.id===item.id)!);
 expect(new Set(matches.map(image=>`${image.src}:${image.cell}`)).size).toBe(catalog.length);
 const sources=[...new Set(matches.map(image=>image.src!))];
 expect(await page.evaluate(async sources=>{return Promise.all(sources.map(async src=>{const image=new Image();image.src=src;await image.decode();return image.naturalWidth>100&&image.naturalHeight>100;}));},sources)).toEqual(sources.map(()=>true));
});
