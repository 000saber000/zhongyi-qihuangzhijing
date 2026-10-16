import {test,expect,type Page} from '@playwright/test';

async function prepareStar(page:Page){
 await page.goto('/#home');await page.locator('.universe-stage[data-ready="true"]').waitFor();
 await page.getByRole('button',{name:'暂停粒子动画',exact:true}).click();
 await page.getByRole('button',{name:'筛选 医案研读',exact:true}).click();
 return page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').map(e=>e.name).find(name=>name.includes('/@react-three_fiber.js'))!;
  const {_roots}=await import(/* @vite-ignore */ url),canvas=document.querySelector('.universe-stage canvas') as HTMLCanvasElement;
  const state=_roots.get(canvas).store.getState();state.controls.dispatchEvent({type:'start'});
  state.scene.updateMatrixWorld(true);const targets:any[]=[];
  state.scene.traverse((object:any)=>{if(object.isMesh&&object.parent?.visible!==false&&object.__r3f?.handlers?.onClick)targets.push(object);});
  const star=targets[0],point=star.getWorldPosition(star.position.clone()).project(state.camera),box=canvas.getBoundingClientRect();
  return {x:box.x+(point.x+1)*box.width/2,y:box.y+(1-point.y)*box.height/2,camera:state.camera.position.toArray()};
 });
}

test('clicking beside the small star opens the intended knowledge',async({page})=>{
 await page.setViewportSize({width:1440,height:900});const point=await prepareStar(page);
 await page.mouse.click(point.x+6,point.y);
 await expect(page.getByRole('complementary',{name:'知识详情'})).toBeVisible();await expect(page).toHaveURL(/#universe\/case-learning$/);
});

test('dragging from an enlarged star target rotates the scene without opening knowledge',async({page})=>{
 await page.setViewportSize({width:1440,height:900});const point=await prepareStar(page);
 await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+9,point.y,{steps:5});await page.mouse.up();
 await expect.poll(()=>page.evaluate(async before=>{
  const url=performance.getEntriesByType('resource').map(e=>e.name).find(name=>name.includes('/@react-three_fiber.js'))!;
  const {_roots}=await import(/* @vite-ignore */ url),camera=_roots.get(document.querySelector('.universe-stage canvas')).store.getState().camera;
  return camera.position.toArray().reduce((distance:number,value:number,index:number)=>distance+Math.abs(value-before[index]),0);
 },point.camera)).toBeGreaterThan(1);
 await expect(page).toHaveURL(/#home$/);await expect(page.getByRole('complementary',{name:'知识详情'})).toBeHidden();
});

test.describe('touch star picking',()=>{
 test.use({hasTouch:true});
 test('touching beside a star opens the same knowledge on a phone',async({page})=>{
  await page.setViewportSize({width:390,height:700});const point=await prepareStar(page);
  await page.touchscreen.tap(point.x+6,point.y);await expect(page.getByRole('complementary',{name:'知识详情'})).toBeVisible();await expect(page).toHaveURL(/#universe\/case-learning$/);
 });
});
