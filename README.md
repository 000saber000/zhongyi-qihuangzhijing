# 岐黄知境 · 知识宇宙

保留现有知识星海、知识库与课程阅读体验，提供用户名/密码账号、收藏与课程进度的云端同步。游客记录保存在当前浏览器，登录后由用户选择是否导入；账号间数据隔离。

## 线上服务

- 网站：https://qihuang-zhijing.onrender.com
- 源码：https://github.com/000saber000/zhongyi-qihuangzhijing
- API：见 Render 中 `qihuang-api` 服务的实际 URL。

账号会话保存在当前标签页的 sessionStorage，刷新后可以继续使用；关闭标签页后通常需要重新登录。当前不提供密码找回，请妥善保存密码。

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

现有静态站点继续发布 `qihuang-unified.html`，保持原网址和原部署命令。源码更新后必须重新导出该单文件并提交：

```sh
VITE_API_BASE_URL=https://YOUR-ACTUAL-API.onrender.com npm run release:export
```

把源码和新的 `qihuang-unified.html` 一起提交到 `main`，Render 会自动重新发布。构建变量是公开 API 地址，不包含密码或数据库连接串。

新增 Node API 的构建命令是 `npm ci --prefix server && npm --prefix server run check`，启动命令是 `npm --prefix server start`。配置 `DATABASE_URL`、`ALLOWED_ORIGINS=https://qihuang-zhijing.onrender.com` 和 `SKIP_INSTALL_DEPS=true`。数据库与 API 应处于同一个 Render 工作区与区域，使用内部连接地址。

`render.yaml` 提供可复现的服务配置。为现有资源重建 Blueprint 前，先确认已有服务映射，避免重复创建资源。数据库连接串只保存在 Render 环境设置中，不提交 GitHub。

### 免费套餐限制与备份

根据 [Render 免费套餐文档](https://render.com/docs/free)，免费 PostgreSQL 创建后 30 天到期，到期后不可访问；额外 14 天宽限期后会删除数据。免费数据库没有自动备份，适合开发与预览。长期使用必须在到期前升级或迁移。

免费 Web Service 闲置 15 分钟后会休眠，首次重新访问可能需要约一分钟。若连接超时，页面会保留现有记录并提示重试，不宣称已保存。免费额度为整个工作区共享。

到期前使用 Render 提供的外部连接地址，通过启用 TLS 的 PostgreSQL 客户端导出：

```sh
PGSSLMODE=require pg_dump --dbname="$DATABASE_URL" --format=custom --file=qihuang-backup.dump
```

`DATABASE_URL` 应来自安全的环境变量；备份包含账号摘要与用户记录，妥善保存并避免提交到仓库。迁移到新数据库可使用 `pg_restore`，更新 API 的连接地址后重新部署。恢复时不删除原数据库，直到确认新数据库可用。

## 代码来源与许可证

知识星海改编自 [Cohenjikan/shiyun](https://github.com/Cohenjikan/shiyun)，保留其版权声明：

Required Notice: Copyright © 2026 Cohenjikan — 诗云 / Poetry Cloud

完整条款见 [本仓库的第三方许可证](third-party/SHIYUN-LICENSE.md) 和 [上游 LICENSE](https://github.com/Cohenjikan/shiyun/blob/main/LICENSE)。参考代码使用 PolyForm Noncommercial License 1.0.0。

本站的知识素材用于学习，具体文献出处仍需核对。收藏与课程完成操作不代表内容已审核。
