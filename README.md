# 岐黄知境

本仓库托管上传的单文件网页 `qihuang-unified.html`，保留原始 HTML、样式、脚本及版权声明。

## Render 部署

- 类型：Static Site（静态站点）
- 分支：`main`
- 构建命令：`mkdir -p public && cp qihuang-unified.html public/index.html`
- 发布目录：`public`
- 自动部署：提交到 `main` 后自动更新
- 无需后端、数据库或环境变量

`render.yaml` 提供相同设置，便于使用 Render Blueprint 重建服务。

## 本地预览

```sh
mkdir -p public && cp qihuang-unified.html public/index.html
python3 -m http.server 8000 --directory public
```

打开 http://localhost:8000。

网页中的收藏和学习记录存储在访问者浏览器的 localStorage 中，不会跨设备同步。

## 更新

替换 `qihuang-unified.html` 并提交到 `main`。Render 将重新发布首页。
