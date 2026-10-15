import {test,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:15000});
import {readFile} from 'node:fs/promises';
import {Vector3,PerspectiveCamera} from 'three';
import {fullBodyPose} from '../src/features/meridians/camera';
test('independent page loads one canvas, keeps side on model switch and shares bookmarks',async({page})=>{
 await page.goto('/#meridians');
 await expect(page.getByRole('heading',{name:'经络云图',exact:true})).toBeVisible();
 await expect(page.getByTestId('body-scene')).toHaveAttribute('data-status','ready');
 await expect(page.locator('canvas')).toHaveCount(1);
 await page.getByRole('button',{name:'选择 足三里 ST36'}).click();
 await expect(page.getByTestId('body-scene')).toHaveAttribute('data-focus','point-zusanli:left');
 await page.getByRole('button',{name:'人体右侧',exact:true}).click();
 await page.getByRole('button',{name:'女性人体',exact:true}).click();
 await expect(page.getByTestId('body-scene')).toHaveAttribute('data-variant','female');
 await expect(page.getByTestId('body-scene')).toHaveAttribute('data-status','ready');
 await expect(page.getByTestId('body-scene')).toHaveAttribute('data-focus','point-zusanli:right');
 await expect(page.getByTestId('point-panel')).toContainText('足三里');
 await expect(page.getByRole('button',{name:'人体右侧',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'收藏穴位',exact:true}).click();
 await expect(page.getByRole('button',{name:'取消穴位收藏',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'我的书斋',exact:true}).click();
 await expect(page.getByRole('button',{name:'阅读 足三里'})).toBeVisible();
 await expect(page.getByTestId('body-scene')).toHaveCount(0);
 await page.getByRole('button',{name:'经络云图',exact:true}).click();
 await expect(page.getByRole('button',{name:'女性人体',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('actual visible point is clickable and a rear point is occluded until camera rotates',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/#meridians');
 const scene=page.getByTestId('body-scene');await expect(scene).toHaveAttribute('data-status','ready');await expect(scene).toHaveAttribute('data-focus','full:front');
 const anchors=JSON.parse(await readFile(new URL('../src/features/meridians/anchors.json',import.meta.url),'utf8'));
 const bounds=(await page.locator('canvas').boundingBox())!;
 // Same public full-body preset, projected through a real perspective camera.
 const camera=new PerspectiveCamera(45,bounds.width/bounds.height,.01,30);const pose=fullBodyPose('front',bounds.width/bounds.height);camera.position.fromArray(pose.position);camera.lookAt(...pose.target);camera.updateMatrixWorld();
 const xy=(id:string)=>{const a=anchors.find((a:any)=>a.modelId==='adult-male-v2'&&a.knowledgeId===id&&(a.side==='left'||a.side==='midline'));const p=new Vector3(...a.position as [number,number,number]).project(camera);return {x:bounds.x+(p.x+1)*bounds.width/2,y:bounds.y+(1-p.y)*bounds.height/2};};
 await page.mouse.click(xy('point-fengchi').x,xy('point-fengchi').y);
 await expect(page.getByTestId('point-panel')).not.toContainText('GB20 / ACUPOINT');
 await page.mouse.move(xy('point-shanzhong').x,xy('point-shanzhong').y);
 await expect(page.getByRole('tooltip')).toContainText('膻中');
 await expect(page.getByRole('tooltip')).toContainText('CV17');
 await expect(page.getByTestId('point-panel')).not.toContainText('CV17 / ACUPOINT');
 await page.mouse.move(bounds.x+10,bounds.y+10);
 await expect(page.getByRole('tooltip')).toHaveCount(0);
 await page.mouse.click(xy('point-shanzhong').x,xy('point-shanzhong').y);
 await expect(page.getByTestId('point-panel')).toContainText('膻中');await expect(scene).toHaveAttribute('data-focus','point-shanzhong:midline');
 await page.getByRole('button',{name:'选择 风池 GB20'}).click();await expect(scene).toHaveAttribute('data-focus','point-fengchi:left');
 await page.getByRole('button',{name:'选择 涌泉 KI1'}).click();await expect(scene).toHaveAttribute('data-focus','point-yongquan:left');
});
test('failed model fetch preserves reading, retries, and fast switching commits the latest request',async({page})=>{
 let fail=true;await page.route('**/*adult-male*.glb*',async route=>{const url=new URL(route.request().url());if(url.searchParams.has('import')||url.searchParams.has('url')){await route.continue();return;}if(fail){fail=false;await route.abort();}else await route.continue();});
 await page.goto('/#meridians');await expect(page.getByText('静态学习模式',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'选择 合谷 LI4'}).click();await expect(page.getByTestId('point-panel')).toContainText('合谷');
 await page.getByRole('button',{name:'重新加载模型',exact:true}).click();await expect(page.getByTestId('body-scene')).toHaveAttribute('data-status','ready');
 await page.getByRole('button',{name:'女性人体',exact:true}).click();await page.getByRole('button',{name:'男性人体',exact:true}).click();await page.getByRole('button',{name:'女性人体',exact:true}).click();
 await expect(page.getByTestId('body-scene')).toHaveAttribute('data-variant','female');await expect(page.getByTestId('body-scene')).toHaveAttribute('data-status','ready');
 await expect(page.getByTestId('point-panel')).toContainText('合谷');await expect(page.locator('canvas')).toHaveCount(1);
});
test('mobile real 3D camera repositions on panel expansion and reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});await page.goto('/#meridians');
 await expect(page.getByTestId('body-scene')).toHaveAttribute('data-status','ready');
 await page.getByRole('button',{name:'展开穴位目录'}).click();await page.getByRole('button',{name:'选择 内关 PC6'}).click();
 await expect(page.getByTestId('body-scene')).toHaveAttribute('data-focus','point-neiguan:left');
 await page.getByRole('button',{name:'展开穴位介绍'}).click();await expect(page.getByText('定位线索',{exact:true})).toBeVisible();
 await expect(page.locator('canvas')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect.poll(async()=> (await page.locator('canvas').boundingBox())!.height).toBeLessThan(350);const before=(await page.locator('canvas').boundingBox())!;await page.getByRole('button',{name:'收起穴位介绍'}).click();const after=(await page.locator('canvas').boundingBox())!;await expect.poll(async()=> (await page.locator('canvas').boundingBox())!.height).toBeGreaterThan(before.height);
 await page.setViewportSize({width:844,height:390});await expect(page.getByTestId('body-scene')).toHaveAttribute('data-focus','point-neiguan:left');
});
test('WebGL loss releases the canvas and leaves the selected knowledge readable',async({page})=>{
 await page.goto('/#meridians');await expect(page.getByTestId('body-scene')).toHaveAttribute('data-status','ready');await page.getByRole('button',{name:'选择 百会 GV20'}).click();
 await page.locator('canvas').evaluate(canvas=>canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
 await expect(page.getByText('静态学习模式',{exact:true})).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);await expect(page.getByTestId('point-panel')).toContainText('百会');
 await page.getByRole('button',{name:'重试三维显示',exact:true}).click();await expect(page.getByTestId('body-scene')).toHaveAttribute('data-status','ready');await expect(page.locator('canvas')).toHaveCount(1);await expect(page.getByTestId('point-panel')).toContainText('百会');
});
test('pending and failed switch retain the original canvas, model and successful preference',async({page})=>{
 let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve);let started!:()=>void;const downloading=new Promise<void>(resolve=>started=resolve);let fail=true;
 await page.route('**/*adult-female*.glb*',async route=>{const url=new URL(route.request().url());if(url.searchParams.has('import')||url.searchParams.has('url')){await route.continue();return;}if(fail){started();await held;await route.abort();}else await route.continue();});
 try{
  await page.goto('/#meridians');await expect(page.getByTestId('body-scene')).toHaveAttribute('data-status','ready');await page.getByRole('button',{name:'选择 三阴交 SP6'}).click();
  await page.locator('canvas').evaluate(el=>el.setAttribute('data-persist','original'));await page.getByRole('button',{name:'女性人体',exact:true}).click();await downloading;
  await expect(page.getByTestId('body-scene')).toHaveAttribute('data-variant','male');await expect(page.locator('canvas')).toHaveAttribute('data-persist','original');
  expect(await page.evaluate(()=>localStorage.getItem('qihuang.body.variant.v1'))).toBe('male');release();await expect(page.getByTestId('body-scene')).toHaveAttribute('data-status','error');
  await expect(page.getByTestId('point-panel')).toContainText('三阴交');await expect(page.locator('canvas')).toHaveAttribute('data-persist','original');expect(await page.evaluate(()=>localStorage.getItem('qihuang.body.variant.v1'))).toBe('male');
  fail=false;await page.getByRole('button',{name:'重新加载模型',exact:true}).click();await expect(page.getByTestId('body-scene')).toHaveAttribute('data-status','ready');await expect(page.getByTestId('body-scene')).toHaveAttribute('data-variant','female');await expect(page.locator('canvas')).toHaveAttribute('data-persist','original');
  await expect(page.getByTestId('body-scene')).toHaveAttribute('data-focus','point-sanyinjiao:left');expect(await page.evaluate(()=>localStorage.getItem('qihuang.body.variant.v1'))).toBe('female');
 }finally{release();}
});
test('view buttons keep knowledge while full view and conflicting meridian filter clear it',async({page})=>{
 await page.goto('/#meridians');await expect(page.getByTestId('body-scene')).toHaveAttribute('data-status','ready');await page.getByRole('button',{name:'选择 足三里 ST36'}).click();
 await page.getByRole('button',{name:'观察背面'}).click();await expect(page.getByTestId('point-panel')).toContainText('足三里');await expect(page.getByTestId('body-scene')).toHaveAttribute('data-focus','full:back');
 await page.getByRole('combobox',{name:'筛选经脉'}).selectOption('meridian-gallbladder');await expect(page.getByTestId('point-panel')).not.toContainText('ST36 / ACUPOINT');await expect(page.getByText('已切换经脉筛选，原穴位选择已清除。')).toBeVisible();
 await page.getByRole('button',{name:'选择 风池 GB20'}).click();await page.getByRole('button',{name:'回到人体全景'}).click();await expect(page.getByTestId('point-panel')).not.toContainText('GB20 / ACUPOINT');
});
test('after reading idle the next flight still animates for its own duration',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/#meridians');await expect(page.getByTestId('body-scene')).toHaveAttribute('data-focus','full:front');await page.waitForTimeout(1600);
 const duration=await page.getByRole('button',{name:'选择 足三里 ST36'}).evaluate(button=>new Promise<number>((resolve,reject)=>{
  const scene=document.querySelector('[data-testid="body-scene"]')!,start=performance.now();
  const timer=setTimeout(()=>{observer.disconnect();reject(Error('camera flight did not settle'));},10000);
  const observer=new MutationObserver(()=>{if(scene.getAttribute('data-focus')==='point-zusanli:left'){observer.disconnect();clearTimeout(timer);resolve(performance.now()-start);}});
  observer.observe(scene,{attributes:true,attributeFilter:['data-focus']});(button as HTMLButtonElement).click();
 }));
 expect(duration).toBeGreaterThan(650);
});
test('mobile search, filter, bottom panel and static fallback remain usable',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind:string,...args:any[]){if(kind.includes('webgl'))return null;return (original as any).call(this,kind,...args); } as any;});
 await page.goto('/#meridians');
 await expect(page.getByText('静态学习模式', {exact:true})).toBeVisible();
 await page.getByRole('button',{name:'展开穴位目录'}).click();
 await page.getByRole('searchbox',{name:'搜索穴位'}).fill('风池');
 await page.getByRole('button',{name:'选择 风池 GB20'}).click();
 await expect(page.getByTestId('point-panel')).toContainText('风池');
 await page.getByRole('button',{name:'展开穴位介绍'}).click();
 await expect(page.getByText('定位线索',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'收起穴位介绍'}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'女性人体',exact:true}).click();
 await expect(page.getByTestId('body-preview')).toHaveAttribute('alt',/女性/);
});

test('transparency and independent internal layers survive model and point changes',async({page})=>{
 await page.goto('/#meridians');
 const scene=page.getByTestId('body-scene');await expect(scene).toHaveAttribute('data-status','ready');
 const toggle=page.getByRole('switch',{name:'人体透视'});
 await expect(toggle).not.toBeChecked();
 await expect(page.getByRole('slider',{name:'人体透明度'})).toHaveCount(0);
 await toggle.click();await expect(toggle).toBeChecked();
 const organs=page.getByRole('checkbox',{name:'内脏'}),meridians=page.getByRole('checkbox',{name:'经脉'});
 await expect(organs).toBeChecked();await expect(meridians).toBeChecked();
 const opacity=page.getByRole('slider',{name:'人体透明度'});await expect(opacity).toHaveValue('25');
 await opacity.fill('40');await expect(opacity).toHaveValue('40');
 await organs.uncheck();await expect(organs).not.toBeChecked();
 await page.getByRole('button',{name:'女性人体',exact:true}).click();await expect(scene).toHaveAttribute('data-variant','female');await expect(scene).toHaveAttribute('data-status','ready');
 await expect(toggle).toBeChecked();await expect(organs).not.toBeChecked();await expect(opacity).toHaveValue('40');
 await page.getByRole('button',{name:'选择 内关 PC6'}).click();await expect(scene).toHaveAttribute('data-focus','point-neiguan:left');
 await expect(toggle).toBeChecked();await meridians.uncheck();await organs.check();
 await toggle.click();await expect(opacity).toHaveCount(0);await expect(page.getByTestId('point-panel')).toContainText('内关');
 await toggle.click();await expect(organs).toBeChecked();await expect(meridians).not.toBeChecked();
});

test('an internal-layer download failure preserves the body and can be retried independently',async({page})=>{
 let fail=true;
 await page.route('**/*viscera*.glb*',async route=>{const url=new URL(route.request().url());if(url.searchParams.has('import')||url.searchParams.has('url'))return route.continue();if(fail){fail=false;return route.abort();}return route.continue();});
 await page.goto('/#meridians');await expect(page.getByTestId('body-scene')).toHaveAttribute('data-status','ready');
 await page.getByRole('switch',{name:'人体透视'}).click();
 await expect(page.getByRole('alert')).toContainText('内脏层暂未加载');
 await expect(page.getByTestId('body-scene')).toHaveAttribute('data-status','ready');await expect(page.locator('canvas')).toHaveCount(1);
 await page.getByRole('checkbox',{name:'内脏'}).uncheck();
 await Promise.all([page.waitForResponse(r=>r.url().includes('viscera')&&r.url().includes('.glb')&&!r.url().includes('import')&&!r.url().includes('?url')&&r.ok()),page.getByRole('checkbox',{name:'内脏'}).check()]);
 await expect(page.getByRole('alert')).toHaveCount(0);
 await page.getByRole('button',{name:'选择 百会 GV20'}).click();await expect(page.getByTestId('body-scene')).toHaveAttribute('data-focus','point-baihui:midline');
});

test('a short mobile screen can read knowledge while xray layers remain available',async({page})=>{
 await page.setViewportSize({width:375,height:667});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#meridians');
 await expect(page.getByTestId('body-scene')).toHaveAttribute('data-status','ready');
 await page.getByRole('switch',{name:'人体透视'}).click();
 await page.getByRole('button',{name:'展开穴位目录'}).click();await page.getByRole('button',{name:'选择 内关 PC6'}).click();
 await page.getByRole('button',{name:'展开穴位介绍'}).click();
 const content=page.locator('.point-panel-content');await expect(content).toBeVisible();
 expect(await content.evaluate(e=>e.clientHeight)).toBeGreaterThanOrEqual(80);
 await page.getByRole('button',{name:'阅读完整穴位知识'}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'阅读完整穴位知识'})).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
