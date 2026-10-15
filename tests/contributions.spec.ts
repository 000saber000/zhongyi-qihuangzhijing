import {test,expect,type Page,type APIRequestContext} from '@playwright/test';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const {Pool}=createRequire(import.meta.url)('../server/node_modules/pg');
const api='http://127.0.0.1:3001',password='contribution browser password';
test.use({reducedMotion:'reduce',viewport:{width:390,height:844}});
test.setTimeout(120000);
test.beforeEach(({page})=>page.setDefaultTimeout(15000));
async function account(request:APIRequestContext,admin=false){
 const username='Community_'+Date.now()+'_'+Math.floor(Math.random()*10000),pool=new Pool({connectionString:process.env.TEST_DATABASE_URL||'postgres://postgres:qihuang_test@127.0.0.1:55432/qihuang_test'});
 try{await pool.query('DELETE FROM auth_rate_limits');const response=await request.post(api+'/api/auth/register',{data:{username,password}});expect(response.status()).toBe(201);if(admin)await pool.query("UPDATE users SET role='admin' WHERE username_key=$1",[username.toLowerCase()]);}finally{await pool.end();}
 const login=await request.post(api+'/api/auth/login',{data:{username,password}});expect(login.status()).toBe(200);return login.json();
}
async function signedIn(page:Page,session:any,path:string){await page.goto('http://127.0.0.1:5173/');await page.evaluate(session=>sessionStorage.setItem('qihuang-session',JSON.stringify(session)),session);await page.goto('http://127.0.0.1:5173'+path);await page.reload();await expect(page.locator('.account-backdrop')).toHaveCount(0);}
async function classic(request:APIRequestContext,admin:any,type='经'){
 const id='classic-community-'+Date.now()+'-'+Math.floor(Math.random()*1000),content={id,type,title:'成员协作典籍 '+id,subtitle:'测试',summary:'原始简介',body:'原文第一段。\n原文第二段。',source:'测试原出处',tags:['经典'],relations:[],confidence:'待核对',keyPoints:['阅读原文']},headers={Authorization:'Bearer '+admin.token};
 const create=await request.post(api+'/api/admin/classics',{headers,data:{content}});expect(create.status()).toBe(201);
 const publish=await request.post(api+'/api/admin/classics/'+id+'/publish',{headers,data:{version:(await create.json()).version}});expect(publish.status()).toBe(200);return content;
}
test('member comments and suggests; admin merges draft and manually publishes; member sees review result',async({page,request,browser})=>{
 const admin=await account(request,true),member=await account(request),item=await classic(request,admin);
 await signedIn(page,member,'/#knowledge/'+item.id);
 const community=page.getByRole('region',{name:'知识讨论'});
 await expect(community.getByRole('heading',{name:'知识讨论'})).toBeVisible();
 await community.getByLabel('评论内容').fill('这段典籍值得重读。<script>纯文本</script>');await community.getByRole('button',{name:'发布评论',exact:true}).click();
 await expect(community.getByText('这段典籍值得重读。<script>纯文本</script>',{exact:true})).toBeVisible();expect(await community.locator('script').count()).toBe(0);
 await community.getByRole('button',{name:'建议修改',exact:true}).click();
 await page.getByLabel('建议正文',{exact:true}).fill('校订正文第一段。\n原文第二段。');await page.getByLabel('修改理由 / 文献依据',{exact:true}).fill('据校订本第一篇修改。');
 await page.getByRole('button',{name:'提交修改建议',exact:true}).click();await expect(community.getByRole('status')).toContainText('已提交');
 await page.getByRole('button',{name:'我的书斋',exact:true}).click();const mine=page.getByRole('region',{name:'我的修改建议'});await expect(mine.getByText(item.title,{exact:true})).toBeVisible();await expect(mine.getByText('待审核',{exact:true})).toBeVisible();
 const context=await browser.newContext({viewport:{width:1463,height:900},reducedMotion:'reduce'}),reviewer=await context.newPage();
 try{
  await signedIn(reviewer,admin,'/#study');await reviewer.getByRole('button',{name:'知识管理',exact:true}).click();
  const review=reviewer.getByRole('region',{name:'修改建议审核'});await review.getByRole('button',{name:'审核建议 '+item.title,exact:true}).click();
  await expect(review.getByText('据校订本第一篇修改。',{exact:true})).toBeVisible();await expect(review.locator('ins')).toContainText('校订');
  await review.getByLabel('处理说明（选填）').fill('已核对，采纳到草稿。');await review.getByRole('button',{name:'采纳并合并草稿',exact:true}).click();await expect(review.getByRole('status')).toContainText('尚未发布');
  await reviewer.getByRole('complementary',{name:'知识列表'}).getByRole('button',{name:new RegExp(item.title)}).click();await expect(reviewer.getByLabel('章节正文',{exact:true})).toHaveValue('校订正文第一段。\n原文第二段。');
  const before=await request.get(api+'/api/knowledge');expect((await before.json()).items.find((i:any)=>i.id===item.id).body).toBe(item.body);
  await reviewer.getByRole('button',{name:'发布知识',exact:true}).click();await expect(reviewer.getByRole('status').filter({hasText:'知识已发布'})).toBeVisible();
  await page.reload();await expect(mine.getByText('已合并草稿',{exact:true})).toBeVisible();await expect(mine.getByText('管理员说明：已核对，采纳到草稿。',{exact:true})).toBeVisible();
  await page.goto('/#knowledge/'+item.id);await page.getByRole('button',{name:'开始阅读',exact:true}).click();await expect(page.getByRole('region',{name:'知识正文'}).getByText('校订正文第一段。\n原文第二段。',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context.close();}
});
test('guests can read comments and see login prompt, while administrators can hide comments',async({page,request})=>{
 const admin=await account(request,true),member=await account(request),item=await classic(request,admin);
 const comment=await request.post(api+'/api/classics/'+item.id+'/comments',{headers:{Authorization:'Bearer '+member.token},data:{body:'需要隐藏的评论'}});expect(comment.status()).toBe(201);
 await page.goto('/#knowledge/'+item.id);const community=page.getByRole('region',{name:'知识讨论'});await expect(community.getByText('需要隐藏的评论',{exact:true})).toBeVisible();await expect(community.getByText('登录后可以评论或提交修改建议。')).toBeVisible();await expect(community.getByRole('button',{name:'发布评论',exact:true})).toHaveCount(0);
 await signedIn(page,admin,'/#knowledge/'+item.id);page.once('dialog',dialog=>dialog.accept());await community.getByRole('button',{name:'隐藏评论',exact:true}).click();await expect(community.getByText('需要隐藏的评论',{exact:true})).toHaveCount(0);
});
test('admin conflict keeps the suggestion pending and member drafts survive failed submission',async({page,request})=>{
 const admin=await account(request,true),member=await account(request),item=await classic(request,admin);
 await signedIn(page,member,'/#knowledge/'+item.id);const community=page.getByRole('region',{name:'知识讨论'});await community.getByRole('button',{name:'建议修改',exact:true}).click();await page.getByLabel('建议正文').fill('成员修订');await page.getByLabel('修改理由 / 文献依据').fill('校订依据');
 await page.route('**/api/classics/'+item.id+'/suggestions',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'UNAVAILABLE',message:'暂不可用'}})}));await page.getByRole('button',{name:'提交修改建议',exact:true}).click();await expect(community.getByRole('alert')).toContainText('暂不可用');await expect(page.getByLabel('建议正文')).toHaveValue('成员修订');await page.unroute('**/api/classics/'+item.id+'/suggestions');await page.getByRole('button',{name:'提交修改建议',exact:true}).click();await expect(community.getByRole('status')).toContainText('已提交');
 const catalog=await request.get(api+'/api/admin/classics',{headers:{Authorization:'Bearer '+admin.token}}),entry=(await catalog.json()).entries.find((e:any)=>e.draft.id===item.id);expect((await request.put(api+'/api/admin/classics/'+item.id,{headers:{Authorization:'Bearer '+admin.token},data:{version:entry.version,content:{...entry.draft,body:'管理员另有修订'}}})).status()).toBe(200);
 await signedIn(page,admin,'/#study');await page.getByRole('button',{name:'知识管理',exact:true}).click();const review=page.getByRole('region',{name:'修改建议审核'});await review.getByRole('button',{name:'审核建议 '+item.title,exact:true}).click();await review.getByRole('button',{name:'采纳并合并草稿',exact:true}).click();await expect(review.getByRole('alert')).toContainText('相同内容已修改');await expect(review.getByRole('button',{name:'采纳并合并草稿',exact:true})).toBeVisible();
 await review.getByLabel('处理说明（选填）').fill('已另行修订，暂不采纳');await review.getByRole('button',{name:'拒绝建议',exact:true}).click();await expect(review.getByRole('status')).toContainText('已拒绝');
});
test('members can enter multiple learning points with the keyboard',async({page,request})=>{
 const admin=await account(request,true),member=await account(request),item=await classic(request,admin);
 await signedIn(page,member,'/#knowledge/'+item.id);await page.getByRole('button',{name:'建议修改',exact:true}).click();
 const points=page.getByLabel('建议学习要点（每行一条）');await points.fill('第一条');await points.press('End');await points.press('Enter');await points.pressSequentially('第二条');await expect(points).toHaveValue('第一条\n第二条');
 await page.getByLabel('修改理由 / 文献依据').fill('补充学习要点');await page.getByRole('button',{name:'提交修改建议',exact:true}).click();await expect(page.getByRole('region',{name:'知识讨论'}).getByRole('status')).toContainText('已提交');
 const mine=await request.get(api+'/api/suggestions/mine',{headers:{Authorization:'Bearer '+member.token}});expect((await mine.json()).suggestions[0].changes.keyPoints).toEqual(['第一条','第二条']);
});
test('draft editing and selection are disabled throughout suggestion acceptance',async({page,request})=>{
 const admin=await account(request,true),member=await account(request),item=await classic(request,admin);
 expect((await request.post(api+'/api/classics/'+item.id+'/suggestions',{headers:{Authorization:'Bearer '+member.token},data:{base:{body:item.body},changes:{body:'合并后的正文'},reason:'校订'}})).status()).toBe(201);
 await signedIn(page,admin,'/#classics');await page.getByRole('complementary',{name:'知识列表'}).getByRole('button',{name:new RegExp(item.title)}).click();
 const review=page.getByRole('region',{name:'修改建议审核'});await review.getByRole('button',{name:'审核建议 '+item.title,exact:true}).click();
 let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve);let started!:()=>void;const barrier=new Promise<void>(resolve=>started=resolve);
 await page.route('**/api/admin/suggestions/*/review',async route=>{started();await held;await route.continue();});
 try{await review.getByRole('button',{name:'采纳并合并草稿',exact:true}).click();await barrier;await expect(page.getByLabel('章节正文',{exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'新增知识',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'发布知识',exact:true})).toBeDisabled();}
 finally{release();}
 await expect(review.getByRole('status')).toContainText('尚未发布');await expect(page.getByLabel('章节正文',{exact:true})).toBeEnabled();await expect(page.getByLabel('章节正文',{exact:true})).toHaveValue('合并后的正文');
});
test('hiding the final comment on page two returns to the remaining comments',async({page,request})=>{
 const admin=await account(request,true),member=await account(request),item=await classic(request,admin),pool=new Pool({connectionString:process.env.TEST_DATABASE_URL||'postgres://postgres:qihuang_test@127.0.0.1:55432/qihuang_test'});
 try{for(let n=0;n<21;n++)await pool.query('INSERT INTO classic_comments(id,classic_id,user_id,author_username,body) VALUES($1,$2,$3,$4,$5)',[randomUUID(),item.id,member.user.id,member.user.username,'分页评论 '+n]);}finally{await pool.end();}
 await signedIn(page,admin,'/#knowledge/'+item.id);const community=page.getByRole('region',{name:'知识讨论'});await community.getByRole('button',{name:'下一页',exact:true}).click();await expect(community.getByRole('button',{name:'隐藏评论',exact:true})).toHaveCount(1);page.once('dialog',dialog=>dialog.accept());await community.getByRole('button',{name:'隐藏评论',exact:true}).click();await expect(community.getByRole('button',{name:'隐藏评论',exact:true})).toHaveCount(20);
});
test('processing the final pending suggestion on page two returns to the remaining queue',async({page,request})=>{
 const admin=await account(request,true),member=await account(request),item=await classic(request,admin),pool=new Pool({connectionString:process.env.TEST_DATABASE_URL||'postgres://postgres:qihuang_test@127.0.0.1:55432/qihuang_test'});
 const saved=await pool.query("UPDATE classic_suggestions SET status='rejected' WHERE status='pending' RETURNING id");
 try{
  for(let n=0;n<11;n++)await pool.query('INSERT INTO classic_suggestions(id,classic_id,user_id,author_username,base,changes,reason) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),item.id,member.user.id,member.user.username,JSON.stringify({body:item.body}),JSON.stringify({body:'分页建议 '+n}),'分页校订 '+n]);
  await signedIn(page,admin,'/#classics');const review=page.getByRole('region',{name:'修改建议审核'});await review.getByRole('button',{name:'下一页',exact:true}).click();await expect(review.getByRole('button',{name:'审核建议 '+item.title,exact:true})).toHaveCount(1);await review.getByRole('button',{name:'审核建议 '+item.title,exact:true}).click();await review.getByRole('button',{name:'拒绝建议',exact:true}).click();await expect(review.getByRole('button',{name:'审核建议 '+item.title,exact:true})).toHaveCount(10);
 }finally{await pool.query("UPDATE classic_suggestions SET status='pending' WHERE id=ANY($1::uuid[])",[saved.rows.map((r:any)=>r.id)]);await pool.query('DELETE FROM classic_suggestions WHERE classic_id=$1',[item.id]);await pool.end();}
});
test('theory knowledge exposes comments and suggestions and can be reviewed and published in knowledge management',async({page,request})=>{
 const admin=await account(request,true),member=await account(request),item=await classic(request,admin,'理');
 await signedIn(page,member,'/#knowledge/'+item.id);const community=page.getByRole('region',{name:'知识讨论'});await expect(community.getByRole('heading',{name:'知识讨论'})).toBeVisible();
 await community.getByLabel('评论内容').fill('阴阳知识也可以交流学习心得。');await community.getByRole('button',{name:'发布评论',exact:true}).click();await expect(community.getByText('阴阳知识也可以交流学习心得。',{exact:true})).toBeVisible();
 await community.getByRole('button',{name:'建议修改',exact:true}).click();const summary=item.summary+'\n建议补充阴阳关系的说明。';await page.getByLabel('建议简介').fill(summary);await page.getByLabel('修改理由 / 文献依据').fill('核对教材后补充说明');await page.getByRole('button',{name:'提交修改建议',exact:true}).click();await expect(community.getByRole('status')).toContainText('已提交');
 await signedIn(page,admin,'/#study');await page.getByRole('button',{name:'知识管理',exact:true}).click();const review=page.getByRole('region',{name:'修改建议审核'});await review.getByRole('button',{name:'审核建议 '+item.title,exact:true}).click();await review.getByRole('button',{name:'采纳并合并草稿',exact:true}).click();await expect(review.getByRole('status')).toContainText('尚未发布');
 await page.getByRole('complementary',{name:'知识列表'}).getByRole('button',{name:new RegExp(item.title)}).click();await expect(page.getByLabel('内容简介',{exact:true})).toHaveValue(summary);await expect(page.getByLabel('知识分类',{exact:true})).toHaveValue('理');await expect(page.getByLabel('知识分类',{exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'发布知识',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'知识已发布'})).toBeVisible();const updated=await request.get(api+'/api/knowledge');expect((await updated.json()).items.find((i:any)=>i.id===item.id).summary).toBe(summary);
});
