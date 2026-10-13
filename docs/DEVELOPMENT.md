# 岐黄知境 · 开发与维护说明

保留现有知识星海、知识库与课程阅读体验，提供用户名/密码账号、收藏与课程进度的云端同步。游客记录保存在当前浏览器，登录后由用户选择是否导入；账号间数据隔离。管理员可以管理账号、协助用户重置密码。

## 线上服务

- 网站：https://qihuang-zhijing.onrender.com
- 源码：https://github.com/000saber000/zhongyi-qihuangzhijing
- API：https://qihuang-api.onrender.com
- 数据库：[qihuang-study](https://dashboard.render.com/d/dpg-db5lq0ss728c7388r170-a)
- API 配置：[环境变量](https://dashboard.render.com/web/srv-db5lqh2d0e5s73ftnfa0/env-vars)

云端 API 首次启动需要在上述环境变量页面添加 `DATABASE_URL`：复制数据库页面的 **Internal Database URL**，填入变量值后选择 Save, rebuild, and deploy。Render 连接器不返回这个连接串，因此该项需要在 Dashboard 内配置；不要把连接串提交到仓库。服务器启动时会自动建表。

账号会话保存在当前标签页的 sessionStorage，刷新后可以继续使用；关闭标签页后通常需要重新登录。请妥善保存密码；忘记密码可联系管理员协助重置，当前不提供邮件找回。

## 本地开发

需要 Node.js 24 与 PostgreSQL 16。安装前后端依赖：

```sh
npm ci
npm ci --prefix server
```

终端一运行后端（示例连接使用本地开发数据库，请替换密码）：

```sh
DATABASE_URL=postgres://postgres:your-password@127.0.0.1:5432/qihuang ALLOWED_ORIGINS=http://127.0.0.1:5173 PORT=3001 npm --prefix server start
```

终端二运行前端：

```sh
VITE_API_BASE_URL=http://127.0.0.1:3001 npm run dev
```

后端启动时执行版本化数据库迁移，不清空已有账号或学习记录。浏览器打开 http://127.0.0.1:5173。

## 验证

服务端集成测试使用随机的独立 PostgreSQL schema，完成后删除该测试 schema。浏览器测试会向测试数据库注册测试账号，并重置认证限速计数，因此只能指向独立测试数据库，禁止使用线上数据库。

```sh
npm --prefix server run check
TEST_DATABASE_URL=postgres://postgres:test-password@127.0.0.1:55432/qihuang_test npm --prefix server test
npm run build
TEST_DATABASE_URL=postgres://postgres:test-password@127.0.0.1:55432/qihuang_test npm test
```

Playwright 配置自动启动测试 API（3001）和 Vite（5173），浏览器默认使用 `/usr/bin/chromium`，可用 `CHROMIUM_PATH` 覆盖。双设备测试使用两个隔离的浏览器 context。

## Render 发布与更新

前端使用 React / TypeScript 模块维护，Vite 将 HTML、CSS 和 JavaScript 构建成独立文件。三维 Canvas 和场景通过动态导入加载，页面导航无需等待星海脚本下载完毕。

标准生产构建：

```sh
VITE_API_BASE_URL=https://qihuang-api.onrender.com npm run build
```

发布目录是 `dist/`：`index.html` 是轻量入口，`assets/` 保存带内容哈希的样式、入口脚本和三维场景脚本。`render.yaml` 的静态站点配置使用 `npm ci --include=dev && npm run build`，发布 `dist`，并设置公开构建变量 `VITE_API_BASE_URL=https://qihuang-api.onrender.com`。哈希资源可以长期缓存，HTML 入口应重新验证。

### 现有站点的兼容发布

当前 Render 服务仍使用 `mkdir -p public && cp qihuang-unified.html public/index.html`，发布目录为 `public`。修改 `render.yaml` 不会自动修改一个已有、未绑定 Blueprint 的服务设置。因此仓库保留完整的分离资源，现有自动发布流程可继续使用：

```sh
VITE_API_BASE_URL=https://qihuang-api.onrender.com npm run release:build
npm run test:production
```

`release:build` 生成 `dist/`，将全部 JS/CSS 资源同步到 `public/assets/`，并生成轻量的 `qihuang-unified.html` 兼容入口和本地预览用的 `public/index.html`。历史文件名保留，但其内容已不再内嵌脚本和样式。提交源码、兼容入口及 `public/assets/` 到 `main`，Render 即可自动发布；`release:export` 与 `demo:export` 是该命令的兼容别名。

生产浏览器检查分别访问标准 `dist/` 与兼容 `public/` 输出，验证外部资源、场景延迟/失败时的导航和游客学习记录。开发测试仍使用上方的独立测试数据库。

以后若在 [静态站点设置](https://dashboard.render.com/static/srv-db5l3pvlk1mc73acpjpg/settings) 将 Build Command 改为 `npm ci --include=dev && npm run build`、Publish Directory 改为 `dist`，并添加上述 API 构建变量，就可以直接提交源码更新。在确认标准构建成功上线后，再移除兼容入口和已提交的 `public/assets/`；不需要重建站点。

新增 Node API 的构建命令是 `npm ci --prefix server --include=dev && npm --prefix server run check`，启动命令是 `npm --prefix server start`。配置 `DATABASE_URL`、`ALLOWED_ORIGINS=https://qihuang-zhijing.onrender.com` 和 `SKIP_INSTALL_DEPS=true`。数据库与 API 应处于同一个 Render 工作区与区域，使用内部连接地址。

`render.yaml` 提供可复现的服务配置。为现有资源重建 Blueprint 前，先确认已有服务映射，避免重复创建资源。数据库连接串只保存在 Render 环境设置中，不提交 GitHub。

### 免费套餐限制与备份

根据 [Render 免费套餐文档](https://render.com/docs/free)，免费 PostgreSQL 创建后 30 天到期，到期后不可访问；额外 14 天宽限期后会删除数据。免费数据库没有自动备份，适合开发与预览。本次创建的数据库将在 **2026-11-10 17:55（北京时间，09:55 UTC）** 到期，长期使用必须在到期前升级或迁移。

免费 Web Service 闲置 15 分钟后会休眠，首次重新访问可能需要约一分钟。若连接超时，页面会保留现有记录并提示重试，不宣称已保存。免费额度为整个工作区共享。

到期前使用 Render 提供的外部连接地址，通过启用 TLS 的 PostgreSQL 客户端导出：

```sh
PGSSLMODE=require pg_dump --dbname="$DATABASE_URL" --format=custom --file=qihuang-backup.dump
```

`DATABASE_URL` 应来自安全的环境变量；备份包含账号摘要与用户记录，妥善保存并避免提交到仓库。迁移到新数据库可使用 `pg_restore`，更新 API 的连接地址后重新部署。恢复时不删除原数据库，直到确认新数据库可用。

## 管理账号

已配置的管理员登录后，在「我的书斋」点击「账号管理」。支持用户名搜索、分页查看注册时间与学习计数、禁用/恢复账号、撤销所有会话、重置密码和删除账号。管理员账号受保护，不能在管理列表中禁用、重置或删除。

重置密码和删除账号需再次输入管理员当前密码；删除还需输入目标用户名确认。删除会同时移除收藏、课程进度和登录会话，操作日志保留用户名快照。重置后页面只显示一次随机临时密码，管理员自行交给对应用户；用户登录后必须修改临时密码才能继续使用。临时密码不会写入浏览器存储或操作日志。

所有登录用户均可在「我的书斋」点击「修改密码」。成功后所有旧会话失效，当前浏览器获得新会话，其他设备需重新登录。

首次设置管理员：先通过网站正常注册负责人账号，再在 Render API 服务环境变量中添加 `INITIAL_ADMIN_USERNAME`，值填已注册的用户名，重新部署。启动时仅提升该已有账号；账号不存在、被禁用或已有另一管理员时启动失败，不会为日后注册的人自动授予权限。不要填写密码。角色保存在数据库，注册接口不能指定管理员角色。

## AI 学习助手与模型设置

AI 学习助手采用平台统一接入模型、登录用户按额度使用的方式。模型 API 配置入口及其后端接口仅允许已登录、数据库角色为 `admin`、用户名规范化后为 `aidejiasinuo` 的有效账号访问；前端隐藏入口不能代替后端权限校验。普通用户可以按额度聊天，但不能配置模型、替换密钥或读取密钥。

点击全站「问岐黄」，或在知识详情、星海详情和课程导读点击「请 AI 讲解」。登录后可以连续追问、停止回答和新建对话。参考卡片来自服务器检索的已发布条目；资料仍以简介和导读为主，不能把 AI 解释当作已核对的原典引文。对话只保存在当前页面内存，关闭窗口后仍可打开继续，刷新或退出账号后清空，第一版没有跨设备聊天历史。

`aidejiasinuo` 登录后，在「我的书斋 → 模型设置」选择 DeepSeek、通义千问或 OpenAI，填写模型名称及 API 密钥，保存后点击「测试连接」。连接成功后勾选「开启学习助手」并保存。 临时停用时点击「关闭 AI」，无需保存其他字段，已保存的密钥与模型名称保留。要删除接入信息，点击「清空模型配置」并确认：服务器中的模型名称和密钥会删除，AI 同时关闭；额度设置与已产生的用量保留。关闭或清空会中止正在生成的回答，未输出文本的请求返还额度。测试连接会消耗少量模型用量，不计入用户聊天额度。默认关闭，未配置时用户会看到明确提示。

模型密钥由服务端用 AES-256-GCM 加密后保存在 `ai_settings`，完整密钥不回显，不进入前端构建变量、浏览器存储、响应正文或日志。留空保留已有密钥，更换厂商需填写该厂商密钥。第一版仅支持厂商固定 HTTPS 接口，不开放自定义地址。

保存密钥前，API 服务须设置 `AI_CONFIG_ENCRYPTION_KEY`：32 字节随机值的标准 base64 字符串。Blueprint 为新环境生成该值；已有、未绑定 Blueprint 的服务须单独添加。可在受控终端生成后直接保存到 Render 环境变量，不提交仓库或填入前端变量：

```sh
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"
```

该加密密钥需稳定保留；更换后原有模型密钥不能解密，管理员必须重新填写模型密钥。数据库备份包括 `ai_settings`、`ai_usage` 和 `ai_activity`，恢复时需要原服务端加密密钥。不要因 AI 接入而修改已设置的 `INITIAL_ADMIN_USERNAME` 或重新提升账号权限。

默认每人每天 10 次、全站每天 200 次；管理员可调整个人限额（1–100）、全站限额（1–10000）和单次回答 token 上限（128–2048，默认 1024）。额度在北京时间零点重置，事务预留确保并发不超额。同一账号只能同时生成一个回答，生成最长 90 秒，停止或关闭窗口会中止上游调用。未生成文本的失败请求返还额度，已经输出文本的停止或失败仍计一次。调用次数限制不等于金额预算，建议在厂商平台同时设置消费限额。

新增测试使用独立测试数据库及模拟模型，不调用真实模型：

```sh
TEST_DATABASE_URL=postgres://postgres:qihuang_test@127.0.0.1:55432/qihuang_test server/node_modules/.bin/tsx --test server/tests/ai.test.ts
TEST_DATABASE_URL=postgres://postgres:qihuang_test@127.0.0.1:55432/qihuang_test npx playwright test tests/ai.spec.ts
```


## 典籍管理

管理员登录后，在「我的书斋」点击「典籍管理」，或打开 `/#classics`。选择已有典籍或点击「新增典籍」，填写名称、简介、原文 / 正文、文献出处、标签、关联知识及学习要点，然后按 **保存草稿 → 预览内容 → 发布典籍** 操作。

保存草稿不会改变公开内容。发布后知识库、搜索、学习导读、正文及知识星海读取同一云端发布目录；其他浏览器刷新、重新聚焦或每分钟自动尝试同步。API 不可用时保留内置或当前已载入内容，并提供「重试同步内容」。日常更新无须重新打包网站。

正文支持纯文本和换行，最多 50000 字符；第一版不含文件上传、章节目录和删除。编号由小写字母、数字和短横线组成，创建后保留原编号。编辑冲突时不覆盖其他窗口的修改；输入保留，可先复制保存，再重新载入最新版本。登录过期也会保留当前输入，重新登录同一管理员后可继续。

沿用上方的管理员配置，无须设置另一套账号或密码。第三版迁移导入现有知识和导读，只执行一次，不覆盖后台编辑内容。数据库备份需要包含 `knowledge_entries`。

## 代码来源与许可证

知识星海的部分渲染代码与关联光束基于 [Cohenjikan/shiyun 的 MIT 版本 `928c79e`](https://github.com/Cohenjikan/shiyun/tree/928c79ed554204b0033300ecd6c2529cc4e55764)（2026-06-27）改编，保留其版权声明：

Copyright (c) 2026 Cohenjikan — 诗云 / Poetry Cloud

上述复用代码使用 MIT License，完整条款见 [本仓库的第三方许可证](../third-party/SHIYUN-LICENSE.md) 和 [该版本的上游 LICENSE](https://github.com/Cohenjikan/shiyun/blob/928c79ed554204b0033300ecd6c2529cc4e55764/LICENSE)。来源与版本核验见 [来源记录](../third-party/SHIYUN-SOURCE.md)。网站发布时附带 `public/licenses/shiyun-MIT.txt`，标准 Vite 构建与兼容发布均保留该许可文件，效果设置中的「查看许可证」链接指向它。其他代码和素材的许可独立处理。

本站的知识素材用于学习，具体文献出处仍需核对。收藏与课程完成操作不代表内容已审核。
