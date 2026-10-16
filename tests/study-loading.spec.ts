import {test,expect} from '@playwright/test';

test('loading the study animation cannot discard a newly opened login form',async({page})=>{
 let release!:()=>void,requested!:()=>void;
 const held=new Promise<void>(resolve=>release=resolve),started=new Promise<void>(resolve=>requested=resolve);
 await page.route(/\/src\/components\/JadePageMotion\.tsx(?:\?.*)?$/,async route=>{requested();await held;await route.continue();});
 try{
  await page.goto('/#study');await started;
  await expect(page.getByRole('button',{name:'注册 / 登录',exact:true})).toHaveCount(0);
  release();
  await page.getByRole('button',{name:'注册 / 登录',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'账号登录',exact:true});
  await dialog.getByLabel('用户名',{exact:true}).fill('PreserveLearner');
  await expect(dialog.getByLabel('用户名',{exact:true})).toHaveValue('PreserveLearner');
  await expect(dialog).toBeVisible();
 }finally{release();}
});
