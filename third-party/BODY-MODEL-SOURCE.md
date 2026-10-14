# 经络云图人体资产来源

这两个静态模型由本项目的 `scripts/anatomy/build-models.py` 在 Blender 4.3.2 中独立生成。基础网格、体形目标和教学服辅助网格来自 [MakeHuman Community / MPFB2](https://github.com/makehumancommunity/mpfb2)，固定于 `3af0cd5a2ffba072e93a34e5f6f494fdc4813ddf`。

使用的资产范围是 `src/mpfb/data/3dobjs/base.obj`、`src/mpfb/data/targets` 及基础网格辅助组。它们适用上游 `LICENSE.ASSETS.md` 的 CC0 1.0，完整文本保存于 [MPFB-ASSETS-LICENSE.md](MPFB-ASSETS-LICENSE.md)。上游程序适用 GPLv3，但程序并未打包到网站；上游 `LICENSE.md` 明确区分程序和模型导出物。本项目只分发 CC0 资产的派生网格、预览和独立编写的生成脚本。

男女模型分别使用成人 male / female 体形参数生成，并分别规范化至 1.78 m 和 1.70 m。教学服、青玉材质、固定姿态、眼部与细节均在本地导出。GLB 是自包含、无外部纹理、无动画的 Y-up 米制资产。两版不可互换穴位坐标。参数、上游版本和模型 SHA-256 保存于 `src/assets/anatomy/models.manifest.json`，可编辑源文件位于 `art/model-sources/`，六张真实模型渲染在 `src/assets/anatomy/`。

构建方法（需固定版本的 MPFB 源码和 Blender，不是网站运行依赖）：

```sh
blender -b --python scripts/anatomy/build-models.py -- --mpfb-source /path/to/mpfb2 --output src/assets/anatomy --sources art/model-sources
blender -b --python scripts/anatomy/annotate-models.py -- --root .
python3 scripts/anatomy/verify-assets.py src/assets/anatomy
```

模型与 68 个穴位侧别锚点按真实文件哈希绑定。锚点根据每版模型自身的关节、比例及表面投影生成，属于三维学习示意，未经过临床定位核验。更换或重导模型必须重做投影与多角度检查。

定位参考以 KMCRIC 的 WHO 标准位置数据库为主；肩井采用 PMC5817322 的标准位置段落，膻中采用 PLOS ONE 10.1371/journal.pone.0316804 的位置表。逐穴来源、条目编号与核对日期见 `src/features/meridians/acupoints.json`。本站提供自行概括的定位学习文字，不复制来源图片或视频，不提供进针操作或深度建议。已有知识介绍仍复用本站已发布的知识目录，其来源说明仍按该目录展示。

第一版呈现 20 种代表穴位（6 种中线、14 种双侧），每版 34 个标记。只有部分经脉具备点位，因此本版使用经脉分类筛选，不绘制未经逐段核对的完整循行路线。
