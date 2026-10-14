# 经络云图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为岐黄知境完成可切换男女青玉人体的经络云图，支持现有 20 种穴位的点击定位与知识阅读。

**Architecture:** 人体页拥有独立场景与状态，模型、穴位坐标和经脉路径分别管理。知识与收藏复用现有公开目录及学习记录接口。切换模型时以最新请求为准，进入人体页只运行人体 Canvas。

**Tech Stack:** React 18、TypeScript、Three.js、React Three Fiber、Drei、Zustand、Vite、Playwright；模型制作使用 Blender 4.3.2 与固定版本 MPFB 核心资源。

**Spec:** [2026-10-15-meridian-body-design.md](../specs/2026-10-15-meridian-body-design.md)

**Status:** 用户已明确要求直接实施，采用当前助手直接执行方式；不再重复询问计划或执行方式。模型形态按已确认青玉参考进行多角度自查，交付后可依据用户反馈调整。

## Global Constraints

- 提供男性、女性两套人体，由用户自行切换。
- 同一穴位知识只保存一份；双侧穴位有独立的左右标记和坐标。
- 中线穴位只渲染一次，不机械生成左右两个点。
- 左右名称以人体自身为准，列表和面板同步注明。
- 两版统一世界坐标约定：米制、Y 向上、人体正面朝 +Z；左右按人体自身定义。
- 设计预算为每版 GLB 不超过 4 MB、主体不超过约 5 万三角面。
- 约 0.7–1 秒内靠近目标；实施时固定默认时长为 900 毫秒。
- 用户启用减少动态效果时改为直接定位。
- 模型形态先交付男女各一组正面、侧面、背面预览。用户验收后再开始穴位标注。
- 首版人体材质不依赖 Bloom 和多层后处理；手机 DPR 上限 1.5。
- 人体页专属 AI 功能和学习测验属于后续扩展，不加入首版。
- 不创建第二套知识库或账户，不修改现有用户数据，不自动发布后台草稿。
- 不把针刺操作、症状配穴或临床精确定位作为本功能的内容或能力。
- 仅使用具备明确许可的模型资源；保存来源、固定版本和本项目修改说明。

## Review Focus

1. 用户快速从男性切到女性再切回男性：最后一次选择生效，迟到的加载不能覆盖新状态。
2. 云端目录更新后选中穴位被移除：面板和光点同步清除，不继续显示未公开内容。
3. 人体背面穴位与正面穴位在屏幕上重合：不得透过人体误选背面点，列表仍可定位它。
4. 手机面板展开、横竖屏切换及减少动态效果：选中点仍在可见区域，手动操作可打断自动镜头。
5. 模型缓存切换、首次加载失败和 WebGL 上下文丢失：保留阅读能力，重试后无已销毁共享几何体或双 Canvas。

## 文件与测试约定

- 产品模块：`src/features/meridians/`。
- 模型与预览：`src/assets/anatomy/`；GLB 与图片通过 Vite 的 `?url` 导入打包。
- 空间标注：`src/features/meridians/data/`；不修改星云 `knowledgeSpace.ts`。
- 可编辑模型源文件：`art/model-sources/`，与网页用轻量 GLB 分开。
- 资产制作与校验：`scripts/anatomy/`。
- 纯逻辑测试：`src/features/meridians/__tests__/*.test.ts`，使用已有服务端 tsx 和 `node:test`，不引入新测试框架。
- 交互测试：`tests/meridians.spec.ts`；生产资源检查扩展 `tests/production/meridians.spec.ts`。
- 独立人体浏览器配置：`playwright.meridians.config.ts`，启动 Vite 于 5175，模拟公开目录，不依赖真实用户或线上数据库。
- 本计划中 `Knowledge` 始终指 `src/data/catalog.ts` 已有类型。

## 共用数据接口

在 Task 2 的 `types.ts` 定义，后续任务使用同一组名称：

```ts
type ModelVariant = 'male' | 'female';
type PointSide = 'left' | 'right' | 'midline';
type Vec3 = readonly [number, number, number];
type Selection = {knowledgeId: string; side: PointSide} | null;
type ReviewRecord = {source: string; section: string; checkedAt: string};
type BodyModel = {
  id: string; variant: ModelVariant; sha256: string;
  sourceFile: string; previewFiles: Record<'front'|'side'|'back', string>;
};
type AcupointDefinition = {
  knowledgeId: string; referenceCode: string;
  meridianId: string | null; sides: readonly PointSide[];
  locationText: string; review: ReviewRecord;
};
type AcupointAnchor = {
  knowledgeId: string; modelId: string; side: PointSide; modelSha256: string;
  position: Vec3; outwardNormal: Vec3;
  viewDirection: Vec3; viewDistance: number; review: ReviewRecord;
};
type MeridianPath = {
  meridianId: string; modelId: string; modelSha256: string;
  side: PointSide; points: readonly Vec3[]; review: ReviewRecord;
};
type DisplayedAcupoint = {definition: AcupointDefinition; knowledge: Knowledge};
```

## Task 1: 制作并验收男女人体资产

**Files:** Create `scripts/anatomy/build-models.py`, `scripts/anatomy/verify-assets.py`, `art/model-sources/`, `src/assets/anatomy/`, `third-party/BODY-MODEL-SOURCE.md`, `third-party/MPFB-ASSETS-LICENSE.md`.

**Interfaces:** 产出 `adult-male-v1.glb`、`adult-female-v1.glb`、男女各三张视图、可编辑 `.blend` 源文件和含 SHA-256 的 `src/assets/anatomy/models.manifest.json`。制作入口为 `blender -b --python scripts/anatomy/build-models.py -- --output src/assets/anatomy --sources art/model-sources`。

- [ ] **Step 1: 固定来源与确认工具入口。** 使用已核验存在的 `makehumancommunity/mpfb2` 提交 `3af0cd5a2ffba072e93a34e5f6f494fdc4813ddf`。基底位于 `src/mpfb/data/3dobjs/base.obj`；资产许可位于 `LICENSE.ASSETS.md`。其 `LICENSE.md` 区分 GPL 程序代码与 CC0 核心资产。仅把许可明确的资产或导出模型放入网站，不复制插件程序代码到前端。
- [ ] **Step 2: 制作模型。** 在该版本 MPFB 中使用 `HumanService.create_human` 和独立的男女宏观形态配置建立成年模型，采用相同固定教学姿态；在 Blender 中处理完整覆盖的教学服外观、青玉材质、面部及手足细节，烘焙姿态并导出 GLB。保存制作参数和源文件，不用缩放同一个模型伪装男女两版。
- [ ] **Step 3: 校验真实资产。** `python3 scripts/anatomy/verify-assets.py src/assets/anatomy` 检查两份 GLB 不相同、文件大小不超过 4 MB、三角面不超过 50000、GLB 内无外部图片 URL、坐标与脚底原点一致，生成模型哈希。缺失资产时必须非零退出，不能生成“校验通过”的占位报告。
- [ ] **Step 4: 输出并人工复核六张视图。** 确认脸、手指、脚部、关节与材质，显示坐标方向及版本；提交给用户验收模型形态。只有得到这组实际模型预览的验收后冻结版本并进入 Task 2 的点位标注。
- [ ] **Step 5: 保存来源与阶段结果。** 把固定 SHA、资源路径、完整资产许可、制作参数、导出哈希和六张预览写入来源记录。提交已验收的资产及制作脚本；如实际模型尚未获验收，明确标记模型阶段等待验收，不开始标注。

## Task 2: 整理定位资料与建立空间注册表

**Files:** Create `src/features/meridians/types.ts`, `registry.ts`, `data/acupoints.json`, `data/anchors.json`, `data/meridian-paths.json`, `__tests__/registry.test.ts`, `scripts/anatomy/export-anchors.py`; modify Task 1 的模型源文件以加入标注对象。

**Interfaces:** `validateRegistry(models: readonly BodyModel[], definitions: readonly AcupointDefinition[], anchors: readonly AcupointAnchor[], paths: readonly MeridianPath[]): string[]`; `getAnchor(anchors: readonly AcupointAnchor[], modelId: string, selection: Selection): AcupointAnchor | null`。

- [ ] **Step 1: 写失败测试。** `registry.test.ts` 覆盖未知模型、哈希不匹配、重复的穴位 / 模型 / 侧别组合、缺失女版左侧锚点、零长度法线、非有限坐标，以及中线穴位不能有左右重复锚点。断言无效数据返回明确问题，`getAnchor` 不回退到另一版或另一侧。
- [ ] **Step 2: 验证测试先失败。** 运行 `server/node_modules/.bin/tsx --test src/features/meridians/__tests__/registry.test.ts`，应因缺失注册表实现失败。
- [ ] **Step 3: 实现接口与整理 20 种穴位资料。** 逐点核对标准名称 / 编号、经脉、左右规则、定位文字与具体来源；奇穴单独记录适用来源。以设计稿的 20 个现有知识 ID 为完整目标清单，不将概括性简介视为定位依据。
- [ ] **Step 4: 在冻结模型上标注并导出。** Blender 标注对象按 `knowledgeId:side` 命名，分别整理两版表面位置、法线、可见观察方向和距离。经脉路径单独标注，只导出有来源与核验记录的路径，不能把点位直接串成完整经脉。`export-anchors.py` 同时写入绑定模型的哈希；人工核验点位与观察方向，记录核验内容，不冒充专业临床认证。
- [ ] **Step 5: 运行校验并提交。** 单元测试通过；注册表校验返回空问题列表；20 个目标 ID 均有资料与两版所需侧别的坐标。模型改动导致哈希失配时必须重新标注 / 核验，不能只改哈希绕过检查。提交资料、注册表与校验测试。

## Task 3: 实现选择、公开目录和模型切换状态

**Files:** Create `src/features/meridians/state.ts`, `catalog.ts`, `preferences.ts`, `__tests__/state.test.ts`, `__tests__/catalog.test.ts`。

**Interfaces:** `meridianReducer(state: MeridianState, action: MeridianAction): MeridianState`; `filterAcupoints(definitions: readonly AcupointDefinition[], knowledge: readonly Knowledge[], query: string, meridianId: string | null): DisplayedAcupoint[]`; `readModelPreference(storage: Pick<Storage,'getItem'> | null): ModelVariant`; `writeModelPreference(storage: Pick<Storage,'setItem'> | null, variant: ModelVariant): void`。

- [ ] **Step 1: 写失败测试。** 状态区分 `displayedVariant`、`requestedVariant`、`requestId`、`selection`、`query`、`meridianId` 和加载错误。测试女版请求 1、男版请求 2 后，女版请求 1 的完成 / 失败都不改变当前状态；模型请求不清除选择侧别。目录测试移除选中知识后选择被清除、正文更新被读取、无公开知识的锚点不出现。偏好测试非法值 / 读取或写入抛错均不影响使用，初次默认为男性。
- [ ] **Step 2: 运行相应测试并确认失败。** 使用上述已有 tsx 测试命令，指向 `state.test.ts` 与 `catalog.test.ts`。
- [ ] **Step 3: 实现状态和查询接口。** 偏好键固定为 `qihuang-meridians:model`，只在模型成功显示后写入。模型切换失败保留当前模型；筛选冲突与目录删除清除选择。正文读取现有 `knowledge`，不复制为另一份正文数据库。
- [ ] **Step 4: 验证真实公开目录的覆盖范围。** 使用既有公开内容读取方式确认这 20 种穴位已发布。缺少条目时走现有合法内容发布流程，不能自动发布已有草稿或覆盖管理员修改；无法完成发布时报告具体缺口，不能用“全部已完成”掩盖缺失条目。
- [ ] **Step 5: 运行测试并提交。** 以上所有状态、目录和存储失败测试通过；测试不使用线上账号或修改用户数据。

## Task 4: 接入独立人体场景与资源加载

**Files:** Create `src/features/meridians/BodyCanvas.tsx`, `BodyScene.tsx`, `bodyAssets.ts`, `modelLoader.ts`, `MeridianLayer.tsx`; modify `src/App.tsx`, `src/features/universe/Universe.tsx`; create `playwright.meridians.config.ts`, `tests/meridians.spec.ts`。

**Interfaces:** `loadBodyModel(variant: ModelVariant): Promise<THREE.Group>`；`BodyCanvas({variant,selection,onSelect,onModelReady,onModelError,onInteractionStart}: BodyCanvasProps)`。资源地址仅从 `bodyAssets.ts` 的两版清单读取。`Universe` 新增 `sceneMode?: 'cosmos' | 'body'`，默认 `cosmos`，不改变原有页面默认行为。

- [ ] **Step 1: 写失败浏览器测试。** 非人体页不请求人体 GLB；进入 `#meridians` 只有一个人体 Canvas、没有星云 Canvas；普通页面之间仍复用原来的星云 Canvas。测试男→女→男请求乱序、缓存切换和首次模型 404。
- [ ] **Step 2: 运行 `npx playwright test --config playwright.meridians.config.ts`。** 先因人体路由 / 控件不存在失败。配置使用 5175 的 Vite 与模拟公开目录，避免数据库依赖。
- [ ] **Step 3: 实现场景与加载接口。** Canvas 懒加载、`frameloop="demand"`、手机 DPR 上限 1.5。只有显示中的人体挂载到场景，切换前保留旧场景，迟到请求只进入缓存而不能覆盖显示状态。场景独占材质与对象由场景释放，共享模型几何体由缓存管理；不在卸载时销毁仍会复用的几何体。
- [ ] **Step 4: 接入导航和场景模式。** 新增「经络云图」入口与 `#meridians`；人体模式隐藏星云搜索、设置、统计和操作提示。经脉层只读取通过校验的路径。离开人体页恢复星云原有功能，隐藏标签页暂停人体动画。
- [ ] **Step 5: 运行加载 / 生命周期测试并提交。** 验证首次加载、乱序、缓存、失败，以及返回知识库后的星云恢复；不以两个 Canvas 叠加隐藏来替代场景切换。

## Task 5: 实现穴位命中与相机飞入

**Files:** Create `src/features/meridians/AcupointLayer.tsx`, `picking.ts`, `camera.ts`, `BodyCameraRig.tsx`, `__tests__/camera.test.ts`, `__tests__/picking.test.ts`; extend `tests/meridians.spec.ts`。

**Interfaces:** `isAnchorVisible(cameraPosition: Vec3, anchor: AcupointAnchor, firstBodyHitDistance: number | null): boolean`；`planCameraTransition(start: CameraPose, anchor: AcupointAnchor, bodyBounds: BodyBounds, viewport: Viewport, reducedMotion: boolean): CameraTransition`。`CameraPose` 包含 `position` 与 `target`；`CameraTransition` 固定 `durationMs` 并提供 `sample(t: number): CameraPose`，`t` 在 `[0,1]` 内。

- [ ] **Step 1: 写失败测试。** 正面与背面点投影重合时，身体先被射线命中则背面点不可选；中线只渲染一个标记；缺失锚点不回退。相机测试后颈、手掌内侧和脚底的预设方向，900 毫秒动画终点、减少动态时 0 毫秒、手动打断和后一次选择取代前一次选择。
- [ ] **Step 2: 运行相应单元测试，确认先失败。** 再运行浏览器的代表点命中用例，确认未实现的交互不能被列表状态伪装为通过。
- [ ] **Step 3: 实现命中与镜头接口。** 光点有放大的命中区域，但先做朝向与身体射线遮挡判断。镜头转向沿人体外侧安全路径绕行，再沿已核验观察方向接近目标；不能直线穿过躯干。通过场景实际可用尺寸构图，不按整个窗口尺寸假定面板透明。
- [ ] **Step 4: 接入相机与控制。** 自动运动期间逐帧 `invalidate`，结束即停止；OrbitControls `onStart` 取消自动运动。正 / 背 / 左右侧面保留选择；「回到全身」清除选择。选中点显示暖金环，标签只显示悬停 / 选中项。
- [ ] **Step 5: 运行测试与截图复核并提交。** 实际模型上分别核验前侧、后侧、手部和脚底。自动化测试证明选择和状态，但不能代替模型多视角检查。

## Task 6: 实现知识面板和手机布局

**Files:** Create `src/features/meridians/MeridianPage.tsx`, `AcupointPanel.tsx`, `AcupointBrowser.tsx`, `meridians.css`; modify `src/App.tsx`; extend `tests/meridians.spec.ts`。

**Interfaces:** `MeridianPage({knowledge,bookmarks,pendingBookmarks,studyReady,onToggleBookmark,onOpenKnowledge}: MeridianPageProps)`；`AcupointPanel({point,selection,onSideChange,onToggleBookmark,onOpenKnowledge}: AcupointPanelProps)`。知识、收藏和回调来自已有 `useKnowledge`、`useStudy`，不自行请求另一套用户接口。

- [ ] **Step 1: 写失败交互测试。** 电脑端右侧面板；手机 390×844 下底部面板可明确收起 / 展开；无横向溢出；搜索、列表、经脉筛选、左右切换与模型切换均可用键盘操作。测试面板展开 / 横竖屏变化后目标仍位于实际场景范围。
- [ ] **Step 2: 运行人体浏览器测试并确认相应功能先失败。** 已有模型加载用例保持通过。
- [ ] **Step 3: 实现布局与知识接口。** 双侧注明人体自身左右，中线隐藏左右切换。只显示当前已标注经脉与奇穴分类；未整理的路径不虚构线路。模型请求期间禁用人体点选，保留搜索、阅读和最新模型选择；目标版失败提供重试。定位介绍、出处和完整知识详情与已发布目录保持一致。
- [ ] **Step 4: 接入已有收藏与内容变化。** 游客收藏与账号收藏遵循现有 pending / ready 规则；失败不宣称已保存。云端目录更新触发面板更新，移除所选穴位立即清除光点和面板。人体版本只作为浏览器偏好，不引入账号必需条件。
- [ ] **Step 5: 运行交互测试并提交。** 覆盖跨模型保留同一穴位 / 侧别、空搜索、目录变化、存储异常、手机布局和返回完整知识详情。

## Task 7: 失败降级与发布资源

**Files:** Create `src/features/meridians/BodyFallback.tsx`; modify `BodyCanvas.tsx`, `MeridianPage.tsx`, `vite.config.ts`, `scripts/prepare-release.mjs`, `README.md`, `docs/DEVELOPMENT.md`; create `tests/production/meridians.spec.ts`。

**Interfaces:** `BodyFallback({variant,error,onRetry}: {variant: ModelVariant; error: string; onRetry: () => void})`。保留现有 `dist` 与兼容 `public` 发布流程；模型通过 Vite 资源导入进入带哈希的 `assets`，模型许可加入已存在的许可证打包机制。

- [ ] **Step 1: 写失败测试。** 模型 404、WebGL 不支持、上下文丢失时列表与面板可阅读，显示对应模型静态预览，重试后恢复。标准包和兼容包的模型、预览和完整 CC0 许可均返回可用资源，原诗云 MIT 链接仍可用。
- [ ] **Step 2: 运行指定测试并确认缺失行为先失败。** 测试不能用概念图充当男女模型的实际静态预览。
- [ ] **Step 3: 实现降级和打包。** 资源错误进入清晰状态，静态预览不宣称支持 3D 飞入；GPU 失败时不无限重试。所有必需资源同源提供，避免浏览器访问外部资产站。只为许可完整打包扩展构建机制，不更换已有部署方式。
- [ ] **Step 4: 生成发布包并检查。** `VITE_API_BASE_URL=https://qihuang-api.onrender.com npm run release:build`；检查两个发布目录的新模型与许可、旧许可，以及没有被遗漏的资源引用。
- [ ] **Step 5: 跑生产测试并提交。** `npm run test:production`；标准包和兼容包均通过人体页面及原有生产回归。

## Task 8: 最终验收与交付

**Files:** Create `docs/meridian-validation.md`; update `third-party/BODY-MODEL-SOURCE.md` 与本计划复选框；仅在修复验证问题时修改对应产品文件。

**Interfaces:** 验收报告列出模型哈希、20 种穴位与侧别覆盖、来源记录、男女多角度截图、失败用例、手机检查和实际运行的命令；区分自动化通过与人工确认。

- [ ] **Step 1: 核验资产及数据。** 运行模型校验、注册表与纯逻辑测试：`python3 scripts/anatomy/verify-assets.py src/assets/anatomy`；`server/node_modules/.bin/tsx --test src/features/meridians/__tests__/*.test.ts`。不得把未获模型验收或未核验的点位标记为完成。
- [ ] **Step 2: 跑浏览器与生产检查。** `npx playwright test --config playwright.meridians.config.ts`；`npm run test:production`；检查两版模型从不同方向定位，以及 WebGL / 网络失败降级。
- [ ] **Step 3: 回归共享页面与账户。** 在独立临时 PostgreSQL 数据库运行现有 `npm test` 与后端测试，确保新场景模式不破坏导航、收藏、登录与内容同步；禁止指向线上数据库。检查真实手机交互与性能，尚未真机检查时如实说明限制。
- [ ] **Step 4: 自查最终差异与提交。** `git diff --check`，确认没有凭据、外部未授权资源、临床精确性虚假声明，或对星云核心算法的无关修改。保存证据并进行整体验收。
- [ ] **Step 5: 交付或按当前授权发布。** 提供实际可运行结果与验证报告；是否推送和上线以本功能当时的授权为准，不能仅因此前 MIT 修改曾获上线授权而擅自发布新功能。获授权后合并远端最新修改，重新生成资源并验证，推送后确认 Render 的实际新提交部署为 `live`。

## 计划自查与执行交接

- 模型资产与许可：Task 1；实际模型形态验收是点位标注的前置条件。
- 资料、模型版本绑定、左右与中线：Task 2。
- 公开目录、筛选、偏好和最新请求：Task 3。
- 单 Canvas、懒加载与缓存：Task 4。
- 遮挡、局部观察、减少动态与手动打断：Task 5。
- 手机知识面板、收藏和目录变化：Task 6。
- 静态降级、资源完整性与两种发布方式：Task 7。
- 已完成 / 未完成证据、共享功能回归与上线授权：Task 8。

用户已明确选择直接干活。当前助手持续实现全部任务，模型预览验收改为与已确认视觉参考的多角度自查，不在任务之间增加确认关卡；最终进行一次独立代码审阅。
