import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync(new URL('../src/data/knowledge.json',import.meta.url),'utf8'));
test.beforeEach(async({page})=>{await page.route('**/api/knowledge',route=>route.fulfill({json:{items:catalog}}));});

test('every acupoint crop contains one illustration with transparent space around it',async({page})=>{
 await page.goto('/#library');
 const points=catalog.filter((item:{type:string})=>item.type==='穴');
 await expect(page.locator('.library-grid .knowledge-card')).toHaveCount(catalog.length);
 const assignments=await page.locator('.acupoint-illustration[data-image-id]').evaluateAll(images=>images.map(image=>({id:image.getAttribute('data-image-id')!,src:image.getAttribute('data-image-src')!,cell:image.getAttribute('data-image-cell')!.split(',').map(Number)})));
 expect(assignments).toHaveLength(points.length);
 const issues=await page.evaluate(async assignments=>{
  const sources=new Map<string,HTMLImageElement>();
  for(const {src} of assignments){if(sources.has(src))continue;const image=new Image();image.src=src;await image.decode();sources.set(src,image);}
  const issues=[];
  for(const {id,src,cell:[columns,rows,index]} of assignments){
   const image=sources.get(src)!,canvas=document.createElement('canvas');canvas.width=280;canvas.height=280;
   const context=canvas.getContext('2d')!,width=image.naturalWidth/columns,height=image.naturalHeight/rows;
   context.drawImage(image,index%columns*width,Math.floor(index/columns)*height,width,height,0,0,280,280);
   const pixels=context.getImageData(0,0,280,280).data,seen=new Uint8Array(280*280),queue=new Int32Array(280*280);
   let touchesEdge=false,vignettes=0;
   for(let start=0;start<280*280;start++){
    if(pixels[start*4+3]<64)continue;
    const sx=start%280,sy=Math.floor(start/280);if(sx<4||sx>=276||sy<4||sy>=276)touchesEdge=true;
    if(seen[start])continue;
    let head=0,tail=1;queue[0]=start;seen[start]=1;
    while(head<tail){const p=queue[head++],x=p%280,y=Math.floor(p/280);
     for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const nx=x+dx,ny=y+dy;if(nx<0||nx>=280||ny<0||ny>=280)continue;const n=ny*280+nx;if(seen[n]||pixels[n*4+3]<64)continue;seen[n]=1;queue[tail++]=n;}
    }
    if(tail>=1000)vignettes++;
   }
   if(touchesEdge||vignettes!==1)issues.push({id,touchesEdge,vignettes});
  }
  return issues;
 },assignments);
 expect(issues,'Each acupoint must contain one complete isolated vignette').toEqual([]);
});
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
