import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync(new URL('../src/data/knowledge.json',import.meta.url),'utf8'));
const entries=catalog.filter((item:{type:string})=>item.type==='经络');
test.beforeEach(async({page})=>{await page.route('**/api/knowledge',route=>route.fulfill({json:{items:catalog}}));});
test('meridian paths stay within their corresponding painted silhouettes on desktop and mobile',async({page})=>{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});await page.goto('/#library');
  await page.getByRole('navigation',{name:'知识库分类'}).getByRole('button',{name:'经络学说',exact:true}).click();
  await expect(page.locator('.meridian-drawing')).toHaveCount(entries.length);
  const coverage=await page.locator('.knowledge-card.themed-meridian').evaluateAll(async cards=>{
   const decoded=new Map<string,HTMLImageElement>();const reports=[];
   for(const card of cards){
    const art=card.querySelector<SVGSVGElement>('.meridian-drawing')!,route=art.querySelector<SVGPathElement>('.meridian-route')!,image=art.querySelector<SVGImageElement>('.meridian-illustration image')!,wrapper=art.querySelector('[data-image-cell]')!;
    const src=image.href.baseVal;
    if(!decoded.has(src)){const bitmap=new Image();bitmap.src=src;await bitmap.decode();decoded.set(src,bitmap);}
    const bitmap=decoded.get(src)!,canvas=document.createElement('canvas');canvas.width=bitmap.naturalWidth;canvas.height=bitmap.naturalHeight;
    const context=canvas.getContext('2d',{willReadFrequently:true})!;context.drawImage(bitmap,0,0);
    const [columns,rows,index]=wrapper.getAttribute('data-image-cell')!.split(',').map(Number),w=bitmap.naturalWidth/columns,h=bitmap.naturalHeight/rows,left=index%columns*w,top=Math.floor(index/columns)*h;
    const matrix=image.getScreenCTM()!.inverse(),svgMatrix=art.getScreenCTM()!,length=route.getTotalLength();let painted=0;
    for(let n=0;n<80;n++){const point=route.getPointAtLength(length*n/79),pixel=new DOMPoint(point.x,point.y).matrixTransform(svgMatrix).matrixTransform(matrix);
     if(pixel.x>=left&&pixel.x<left+w&&pixel.y>=top&&pixel.y<top+h&&context.getImageData(Math.floor(pixel.x),Math.floor(pixel.y),1,1).data[3]>90)painted++;
    }
    reports.push({name:card.getAttribute('aria-label'),fraction:painted/80});
   }
   return reports;
  });
  for(const report of coverage)expect(report.fraction,`${width}px ${report.name}`).toBeGreaterThanOrEqual(.95);
 }
});
test('the moving highlight follows the painted route and cancellation restores the card',async({page})=>{
 await page.addInitScript(()=>{const animate=Element.prototype.animate;Element.prototype.animate=function(frames,options){const animation=animate.call(this,frames,options);if(this.closest('.book-opening'))animation.pause();return animation;};});
 await page.goto('/#library');const card=page.getByRole('button',{name:'阅读 足少阳胆经',exact:true});await card.click();
 const dialog=page.getByRole('dialog',{name:'正在打开《足少阳胆经》'});await expect(dialog).toBeVisible();
 const path=await dialog.locator('.meridian-route').getAttribute('d');await expect(dialog.locator('.meridian-sweep')).toHaveAttribute('d',path!);
 const initial=await dialog.locator('.meridian-sweep').evaluate(element=>getComputedStyle(element).strokeDashoffset);
 await dialog.evaluate(element=>{for(const animation of element.getAnimations({subtree:true}))animation.currentTime=420;});
 expect(await dialog.locator('.meridian-sweep').evaluate(element=>getComputedStyle(element).strokeDashoffset)).not.toBe(initial);
 await expect(page).toHaveURL(/#library$/);await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(card).toBeFocused();
 await page.waitForTimeout(1400);await expect(page).toHaveURL(/#library$/);
});
