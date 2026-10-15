# 经络云图人体资产来源

## 当前使用：用户提供的 Aholo Lux3D v3 模型

2026-10-15，项目所有者上传 `lux3d_model_exports.zip` 与 `result.zip`，分别包含男性、女性模型。前者还包含一个 STL 几何导出；当前网页使用两包内的 `MODEL.glb` 与各自的 `RawDiffuseFilter.png`。原始 GLB 只有 2×2 占位图，独立漫反射图均为 2048×2048，必须重新绑定后导出。

`scripts/anatomy/prepare-lux3d.py` 使用 Blender 4.3.2 保留全部源网格（男 291,276、女 287,422 三角面），规范化至 1.78 m / 1.70 m、Y-up、脚底原点、正面 +Z，并把对应贴图内嵌到 `adult-male-v3.glb`、`adult-female-v3.glb`。保留运动服纹理；没有重塑身体或以细分冒充新增解剖细节。原始和最终 GLB SHA-256、人工估计的教学标志点记录在 `src/assets/anatomy/models.manifest.json`。

两版为用户提供的生成资产，不标为 MPFB 或 CC0，也不通过本说明额外授予第三方许可。站点内来源说明见 `/licenses/lux3d-models.txt`。上传原件和完整可编辑 Blender 文件在本次会话的 `/workspace/artifacts/qihuang-uploaded-models/`，仓库保留可复现的处理脚本和网页导出。

```sh
blender -b --python scripts/anatomy/prepare-lux3d.py -- --root . --male /path/to/male-export --female /path/to/female-export --sources /path/to/prepared
blender -b --python scripts/anatomy/annotate-models.py -- --root . --sources /path/to/prepared
blender -b --python scripts/anatomy/build-lux3d-paths.py -- --root . --sources /path/to/prepared
python3 scripts/anatomy/verify-assets.py src/assets/anatomy
node scripts/anatomy/verify-views.mjs
```

20 种代表穴位对应每版 34 个独立侧别锚点，按最终网格投影并与其精确摘要绑定。主要经脉体表关系示意经过本项目已标注的同经穴位，分别贴合男女网格；细络是明确标注的视觉示意，不是血管、神经或新增穴位。图层不代表完整内部分支。各点观察方向根据该模型的表面朝向和遮挡检查选取，非临床定位核验。

定位参考以 KMCRIC 的 WHO 标准位置数据库为主；肩井采用 PMC5817322 的标准位置段落，膻中采用 PLOS ONE 10.1371/journal.pone.0316804 的位置表。逐穴来源、条目编号与核对日期见 `src/features/meridians/acupoints.json`。本站提供自行概括的定位学习文字，不复制来源图片或视频，不提供进针操作或深度建议。

## 历史 v1 / v2 资产

保留的早期人体由 `scripts/anatomy/build-models.py` / `build-refined-models.py` 通过 MakeHuman Community / MPFB2 固定版本 `3af0cd5a2ffba072e93a34e5f6f494fdc4813ddf` 生成。其基础网格和体形目标适用上游资产 CC0 1.0，完整文本保存在 [MPFB-ASSETS-LICENSE.md](MPFB-ASSETS-LICENSE.md)，网页许可证 `/licenses/mpfb-CC0.txt` 保留。MPFB 程序本身的 GPLv3 与导出资产许可有别，程序不随网页分发。

独立的 `viscera-v1.glb` 由本项目 `scripts/anatomy/build-organs.py` 制作，属于结构教学示意，未做医学精确认证。
