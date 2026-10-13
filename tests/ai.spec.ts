import {test,expect,type Page} from '@playwright/test';
import {createRequire} from 'node:module';
const {Pool}=createRequire(import.meta.url)('../server/node_modules/pg');
const base='http://127.0.0.1:3001',password='test password 123';
test.use({reducedMotion:'reduce',viewport:{width:390,height:844}});
async function login(page:Page,owner=false){
 const username=owner?'aidejiasinuo':'AiLearner_'+Date.now();const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL||'postgres://postgres:qihuang_test@127.0.0.1:55432/qihuang_test'});
 try{await pool.query('DELETE FROM auth_rate_limits');if(owner)await pool.query("DELETE FROM users WHERE username_key='aidejiasinuo'");
  const registered=await page.request.post(base+'/api/auth/register',{data:{username,password}});expect(registered.status()).toBe(201);
  if(owner)await pool.query("UPDATE users SET role='admin' WHERE username_key=$1",[username]);
 }finally{await pool.end();}
 await page.goto('/#study');await page.getByRole('button',{name:'注册 / 登录',exact:true}).click();await page.getByLabel('用户名',{exact:true}).fill(username);await page.getByLabel('密码',{exact:true}).fill(password);await page.getByRole('button',{name:'登录账号',exact:true}).click();await expect(page.getByText('账号：'+username,{exact:true})).toBeVisible();return username;
}
async function mockStatus(page:Page){await page.route('**/api/ai/status',route=>route.fulfill({json:{enabled:true,remaining:10,dailyLimit:10,globalAvailable:true,resetTimezone:'Asia/Shanghai'}}));}
const frame=(type:string,data:unknown)=>`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
test('guest can open assistant, must log in and can close using Escape',async({page})=>{
 await page.goto('/#library');await page.getByRole('button',{name:'问岐黄',exact:true}).click();const dialog=page.getByRole('dialog',{name:'岐黄学习助手'});await expect(dialog).toBeVisible();await expect(dialog.getByText('登录后，与岐黄一起学习。')).toBeVisible();await dialog.getByRole('button',{name:'前往登录'}).click();await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'注册 / 登录',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'问岐黄',exact:true}).click();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});
test('only designated owner sees model settings, stores key without echo and can test connection',async({page})=>{
 await login(page,true);const config={provider:'deepseek',model:'deepseek-chat',enabled:false,dailyLimit:10,globalDailyLimit:200,maxTokens:1024,version:0,hasKey:false,encryptionReady:true};let saved:any;
 await page.route('**/api/admin/ai',async route=>{if(route.request().method()==='PUT'){saved=route.request().postDataJSON();await route.fulfill({json:{...saved,apiKey:undefined,hasKey:true,version:1}});}else await route.fulfill({json:config});});
 await page.route('**/api/admin/ai/test',route=>route.fulfill({json:{ok:true}}));
 await page.getByRole('button',{name:'模型设置',exact:true}).click();await page.getByLabel('模型 API 密钥',{exact:true}).fill('sk-browser-test-placeholder');await page.getByRole('button',{name:'保存模型设置',exact:true}).click();await expect(page.getByText('模型设置已保存。',{exact:true})).toBeVisible();expect(saved.apiKey).toBe('sk-browser-test-placeholder');await expect(page.getByLabel('模型 API 密钥',{exact:true})).toHaveValue('');await page.getByRole('button',{name:'测试连接',exact:true}).click();await expect(page.getByText('连接成功，可以开启学习助手。',{exact:true})).toBeVisible();
});
test('ordinary member cannot view model settings even by direct navigation',async({page})=>{
 await login(page);await expect(page.getByRole('button',{name:'模型设置',exact:true})).toHaveCount(0);await page.goto('/#ai-settings');await expect(page.getByText('此功能仅供指定管理员使用。',{exact:true})).toBeVisible();await expect(page.getByLabel('模型 API 密钥',{exact:true})).toHaveCount(0);
});
test('mobile explanation keeps context across navigation; streams multi-turn answers, safe text and real reference cards',async({page})=>{
 await login(page);await mockStatus(page);const requests:any[]=[];
 await page.route('**/api/ai/chat',route=>{requests.push(route.request().postDataJSON());return route.fulfill({contentType:'text/event-stream',body:frame('meta',{remaining:9,sources:[{id:'theory-yinyang',title:'阴阳',source:'站内来源',confidence:'待核对'}]})+frame('delta',{text:'阴阳是一种关系。<script>不会执行</script>'})+frame('done',{ok:true})});});
 await page.goto('/#knowledge/theory-yinyang');await page.getByRole('button',{name:'请 AI 讲解',exact:true}).click();const dialog=page.getByRole('dialog',{name:'岐黄学习助手'});await expect(dialog).toBeVisible();await expect(dialog.getByText('正在讨论：阴阳',{exact:true})).toBeVisible();await dialog.getByLabel('发送提问',{exact:true}).click();await expect(dialog.getByText('阴阳是一种关系。<script>不会执行</script>',{exact:true})).toBeVisible();expect(requests[0].contextId).toBe('theory-yinyang');await dialog.getByLabel('向岐黄提问',{exact:true}).fill('举一个例子');await dialog.getByLabel('发送提问',{exact:true}).click();await expect(dialog.getByText('阴阳是一种关系。<script>不会执行</script>',{exact:true})).toHaveCount(2);expect(requests[1].messages.map((m:any)=>m.role)).toEqual(['user','assistant','user']);
 await dialog.getByRole('button',{name:'参考知识 阴阳',exact:true}).first().click();await expect(page).toHaveURL(/knowledge\/theory-yinyang/);await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'问岐黄',exact:true}).click();await expect(dialog.getByText('举一个例子',{exact:true})).toBeVisible();await dialog.getByRole('button',{name:'新建对话',exact:true}).click();await expect(dialog.getByText('举一个例子',{exact:true})).toHaveCount(0);
 const box=await dialog.boundingBox();expect(box!.width).toBeLessThanOrEqual(390);await expect(dialog.getByLabel('向岐黄提问',{exact:true})).toBeFocused();
});
test('upstream error stops loading, offers retry; logout clears prior conversation',async({page})=>{
 await login(page);await mockStatus(page);let failed=true;
 await page.route('**/api/ai/chat',route=>route.fulfill({contentType:'text/event-stream',body:failed?frame('error',{message:'模型暂时不可用'}):frame('delta',{text:'恢复后的回答'})+frame('done',{ok:true})}));
 await page.getByRole('button',{name:'问岐黄',exact:true}).click();const dialog=page.getByRole('dialog',{name:'岐黄学习助手'});await dialog.getByLabel('向岐黄提问',{exact:true}).fill('只属于这个账号的问题');await dialog.getByLabel('发送提问',{exact:true}).click();await expect(dialog.getByText('模型暂时不可用',{exact:true})).toBeVisible();failed=false;await dialog.getByRole('button',{name:'重试回答',exact:true}).click();await expect(dialog.getByText('恢复后的回答',{exact:true})).toBeVisible();await dialog.getByLabel('关闭学习助手',{exact:true}).click();await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.getByRole('button',{name:'问岐黄',exact:true}).click();await expect(dialog.getByText('只属于这个账号的问题',{exact:true})).toHaveCount(0);
});
test('stopping an in-flight request leaves composer usable and ignores late answer',async({page})=>{
 await login(page);await mockStatus(page);let finish:()=>Promise<void>=async()=>{};
 await page.route('**/api/ai/chat',route=>new Promise<void>(resolve=>{finish=async()=>{await route.fulfill({contentType:'text/event-stream',body:frame('delta',{text:'不应出现的迟到回答'})+frame('done',{ok:true})}).catch(()=>{});resolve();};}));
 await page.getByRole('button',{name:'问岐黄',exact:true}).click();const dialog=page.getByRole('dialog',{name:'岐黄学习助手'});await expect(dialog.getByLabel('向岐黄提问',{exact:true})).toBeFocused();await dialog.getByLabel('向岐黄提问',{exact:true}).fill('请解释阴阳');await dialog.getByLabel('发送提问',{exact:true}).click();await expect(dialog.getByLabel('停止生成',{exact:true})).toBeVisible();await dialog.getByLabel('停止生成',{exact:true}).click();await expect(dialog.getByText('已停止生成。',{exact:true})).toBeVisible();await expect(dialog.getByLabel('向岐黄提问',{exact:true})).toBeEnabled();await finish();await expect(dialog.getByText('不应出现的迟到回答',{exact:true})).toHaveCount(0);
 await dialog.getByLabel('关闭学习助手',{exact:true}).click();await expect(page.getByRole('button',{name:'问岐黄',exact:true})).toBeFocused();
});
test('cancelling a pending unauthorized response cannot log out a valid session',async({page})=>{
 await page.addInitScript(()=>{const original=window.fetch.bind(window);window.fetch=async(input,init)=>{
  if(String(input).endsWith('/api/ai/chat'))return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{'));init?.signal?.addEventListener('abort',()=>controller.error(new DOMException('Aborted','AbortError')),{once:true});}}),{status:401,headers:{'Content-Type':'application/json'}});
  return original(input,init);
 };});
 const username=await login(page);await mockStatus(page);await page.getByRole('button',{name:'问岐黄',exact:true}).click();const dialog=page.getByRole('dialog',{name:'岐黄学习助手'});await dialog.getByLabel('向岐黄提问',{exact:true}).fill('解释阴阳');await dialog.getByLabel('发送提问',{exact:true}).click();await expect(dialog.getByLabel('停止生成',{exact:true})).toBeVisible();await dialog.getByLabel('关闭学习助手',{exact:true}).click();await expect(page.getByText('账号：'+username,{exact:true})).toBeVisible();
});
test('browser accepts coalesced small stream frames over 64KB',async({page})=>{
 await page.addInitScript(()=>{const original=window.fetch.bind(window);window.fetch=async(input,init)=>{
  if(String(input).endsWith('/api/ai/chat'))return new Response(('event: delta\ndata: {"text":"字"}\n\n').repeat(2500)+'event: done\ndata: {"ok":true}\n\n',{headers:{'Content-Type':'text/event-stream'}});
  return original(input,init);
 };});
 await login(page);await mockStatus(page);await page.getByRole('button',{name:'问岐黄',exact:true}).click();const dialog=page.getByRole('dialog',{name:'岐黄学习助手'});await dialog.getByLabel('向岐黄提问',{exact:true}).fill('请解释');await dialog.getByLabel('发送提问',{exact:true}).click();await expect(dialog.locator('.ai-answer>p')).toHaveText('字'.repeat(2500));await expect(dialog.getByRole('button',{name:'重试回答',exact:true})).toHaveCount(0);
});
test('owner closes AI immediately despite empty fields or missing encryption; clear has confirmation and persists',async({page})=>{
 await login(page,true);let state={provider:'deepseek',model:'deepseek-chat',enabled:true,dailyLimit:10,globalDailyLimit:200,maxTokens:1024,version:5,hasKey:true,encryptionReady:false};const requests:string[]=[];
 await page.route('**/api/admin/ai',async route=>{
  if(route.request().method()==='DELETE'){requests.push('clear');expect(route.request().postDataJSON().version).toBe(state.version);state={...state,enabled:false,hasKey:false,model:'',version:state.version+1};}
  else if(route.request().method()==='PUT')throw new Error('Closing AI must not submit the model form');
  await route.fulfill({json:state});
 });
 await page.route('**/api/admin/ai/disable',async route=>{requests.push('disable');expect(route.request().postDataJSON().version).toBe(state.version);state={...state,enabled:false,version:state.version+1};await route.fulfill({json:state});});
 await page.getByRole('button',{name:'模型设置',exact:true}).click();await page.getByLabel('模型名称',{exact:true}).fill('');await page.getByRole('button',{name:'关闭 AI',exact:true}).click();await expect(page.getByText('学习助手已关闭，已保存的模型配置保留。',{exact:true})).toBeVisible();expect(state.hasKey).toBe(true);await expect(page.getByLabel('开启学习助手',{exact:true})).not.toBeChecked();
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'清空模型配置',exact:true}).click();expect(requests).toEqual(['disable']);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'清空模型配置',exact:true}).click();await expect(page.getByText('模型配置已清空，学习助手已关闭。',{exact:true})).toBeVisible();await expect(page.getByLabel('模型名称',{exact:true})).toHaveValue('');await expect(page.getByText('尚未保存密钥。',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByLabel('模型名称',{exact:true})).toHaveValue('');await expect(page.getByRole('button',{name:'测试连接',exact:true})).toBeDisabled();expect(requests).toEqual(['disable','clear']);
});
test('failed shutdown and clear retain saved state and show retryable error',async({page})=>{
 await login(page,true);const state={provider:'deepseek',model:'deepseek-chat',enabled:true,dailyLimit:10,globalDailyLimit:200,maxTokens:1024,version:5,hasKey:true,encryptionReady:true};
 await page.route('**/api/admin/ai',route=>route.request().method()==='DELETE'?route.fulfill({status:409,json:{error:{code:'VERSION_CONFLICT',message:'模型设置已在其他窗口更新，请重新载入。'}}}):route.fulfill({json:state}));
 await page.route('**/api/admin/ai/disable',route=>route.fulfill({status:503,json:{error:{code:'UNAVAILABLE',message:'关闭失败，请重试。'}}}));
 await page.getByRole('button',{name:'模型设置',exact:true}).click();await page.getByRole('button',{name:'关闭 AI',exact:true}).click();await expect(page.getByText('关闭失败，请重试。',{exact:true})).toBeVisible();await expect(page.getByLabel('开启学习助手',{exact:true})).toBeChecked();await expect(page.getByRole('button',{name:'关闭 AI',exact:true})).toBeEnabled();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'清空模型配置',exact:true}).click();await expect(page.getByText('模型设置已在其他窗口更新，请重新载入。',{exact:true})).toBeVisible();await expect(page.getByLabel('模型名称',{exact:true})).toHaveValue('deepseek-chat');await expect(page.getByText('密钥已保存，不会回显。',{exact:true})).toBeVisible();await expect(page.getByText('模型配置已清空，学习助手已关闭。',{exact:true})).toHaveCount(0);
});
test('service button closes then enables saved configuration, with a finite busy state and normal cursor',async({page})=>{
 await login(page,true);let state={provider:'deepseek',model:'deepseek-flash',enabled:true,dailyLimit:7,globalDailyLimit:200,maxTokens:1024,version:5,hasKey:true,encryptionReady:true};let enableCalls=0,finishEnable:()=>Promise<void>=async()=>{};
 await page.route('**/api/admin/ai',route=>{expect(route.request().method()).toBe('GET');return route.fulfill({json:state});});
 await page.route('**/api/admin/ai/disable',async route=>{expect(route.request().postDataJSON()).toEqual({version:5});state={...state,enabled:false,version:6};await route.fulfill({json:state});});
 await page.route('**/api/admin/ai/enable',route=>new Promise<void>(resolve=>{enableCalls++;expect(route.request().postDataJSON()).toEqual({version:6});finishEnable=async()=>{state={...state,enabled:true,version:7};await route.fulfill({json:state});resolve();};}));
 await page.getByRole('button',{name:'模型设置',exact:true}).click();await page.getByRole('button',{name:'关闭 AI',exact:true}).click();const enable=page.getByRole('button',{name:'一键开启 AI',exact:true});await expect(enable).toBeEnabled();await enable.hover();await expect(enable).toHaveCSS('cursor','pointer');
 await page.getByLabel('模型名称',{exact:true}).fill('');await enable.click();const pending=page.getByRole('button',{name:'正在开启…',exact:true});await expect(pending).toBeDisabled();await expect(pending).toHaveAttribute('aria-busy','true');await expect(pending).toHaveCSS('cursor','wait');expect(enableCalls).toBe(1);await finishEnable();
 const close=page.getByRole('button',{name:'关闭 AI',exact:true});await expect(close).toBeEnabled();await expect(close).toHaveAttribute('aria-busy','false');await expect(close).toHaveCSS('cursor','pointer');await expect(page.getByLabel('模型名称',{exact:true})).toHaveValue('deepseek-flash');await expect(page.getByLabel('开启学习助手',{exact:true})).toBeChecked();await expect(page.getByLabel('每人每日提问次数',{exact:true})).toHaveValue('7');
 await page.reload();await expect(page.getByRole('button',{name:'关闭 AI',exact:true})).toBeEnabled();
});
test('failed enable stays off and can retry; missing saved key is unavailable rather than waiting',async({page})=>{
 await login(page,true);let state={provider:'deepseek',model:'deepseek-flash',enabled:false,dailyLimit:10,globalDailyLimit:200,maxTokens:1024,version:5,hasKey:true,encryptionReady:true};let attempts=0;
 await page.route('**/api/admin/ai',async route=>{if(route.request().method()==='DELETE')state={...state,model:'',hasKey:false,enabled:false,version:7};await route.fulfill({json:state});});
 await page.route('**/api/admin/ai/enable',route=>{attempts++;return route.fulfill({status:503,json:{error:{code:'AI_KEY_UNAVAILABLE',message:'模型配置暂时无法读取，请联系管理员。'}}});});
 await page.getByRole('button',{name:'模型设置',exact:true}).click();const enable=page.getByRole('button',{name:'一键开启 AI',exact:true});await enable.click();await expect(page.getByRole('alert')).toHaveText('模型配置暂时无法读取，请联系管理员。');await expect(enable).toBeEnabled();await expect(enable).toHaveCSS('cursor','pointer');await expect(page.getByLabel('开启学习助手',{exact:true})).not.toBeChecked();await enable.click();await expect(enable).toBeEnabled();expect(attempts).toBe(2);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'清空模型配置',exact:true}).click();await expect(enable).toBeDisabled();await expect(enable).toHaveCSS('cursor','not-allowed');await expect(page.getByText('请先保存模型名称和 API 密钥，再开启 AI。',{exact:true})).toBeVisible();
});

test('thinking progress is visible and a classified failure stops generation without logout',async({page})=>{
 await page.addInitScript(()=>{const original=window.fetch.bind(window);window.fetch=async(input,init)=>{
  if(String(input).endsWith('/api/ai/chat'))return new Response(new ReadableStream({start(controller){
   const encoder=new TextEncoder();controller.enqueue(encoder.encode('event: progress\ndata: {"stage":"thinking"}\n\n'));
   setTimeout(()=>{controller.enqueue(encoder.encode('event: error\ndata: {"code":"AI_OUTPUT_LIMIT","message":"模型已达到单次输出上限，尚未生成正文。"}\n\n'));controller.close();},1500);
  }}),{headers:{'Content-Type':'text/event-stream'}});return original(input,init);
 };});
 const username=await login(page);await mockStatus(page);await page.getByRole('button',{name:'问岐黄',exact:true}).click();const dialog=page.getByRole('dialog',{name:'岐黄学习助手'});
 await dialog.getByLabel('向岐黄提问',{exact:true}).fill('解释阴阳');await dialog.getByLabel('发送提问',{exact:true}).click();await expect(dialog.getByText('模型正在思考，尚未开始生成正文…',{exact:true})).toBeVisible();await expect(dialog.getByRole('alert')).toHaveText('模型已达到单次输出上限，尚未生成正文。');await expect(dialog.getByLabel('停止生成',{exact:true})).toHaveCount(0);await expect(dialog.getByRole('button',{name:'重试回答',exact:true})).toBeVisible();
 await dialog.getByLabel('关闭学习助手',{exact:true}).click();await expect(page.getByText('账号：'+username,{exact:true})).toBeVisible();
});
