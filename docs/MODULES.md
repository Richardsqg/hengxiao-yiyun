# 横小艺韵：模块与单独查看入口

更新日期：2026-10-18。项目基线：1.4.0。

本项目继续使用一个 GitHub 仓库、一套 React 前端和一套 Node.js 服务。以下六个模块按现有文件和组件划分；共享组件与数据保留在原目录，避免复制页面、重复素材或改变现有后台数据格式。

## 先启动，再打开页面

在自己的电脑上完整下载项目，安装 Node.js 24.x（至少 24.15.0，且小于 25），按根目录 README 的本机启动说明运行服务。Windows 首次隔离试用推荐项目根目录的 `Windows_本机测试.bat`（数据保存在 `data/local-preview/`）；原 `Windows_启动.bat` 和 `Windows_管理员后台.bat` 默认使用原有 `data/`。首次配置时在终端设置管理员密码；密码不写在本说明中。

服务运行后，将下面路径接在 `http://127.0.0.1:3000` 后打开。例如文化寻根为 `http://127.0.0.1:3000/culture`。这些地址仅指运行程序的那台电脑；Codex 云环境里的 `127.0.0.1` 不能直接当成你电脑上可打开的网址。不要直接双击 `dist/index.html`，完整功能需要 Node.js 服务和接口。

| 页面路径 | 页面内容 | 访问范围 |
| --- | --- | --- |
| `/` | 展馆总入口，默认“凤冠360展示” | 公众 |
| `/crown` | 凤冠360展示 | 公众 |
| `/culture` | 文化寻根、三个系列、五门课程图文 | 公众 |
| `/films` | 影像展厅、三部影片与课程简介 | 公众 |
| `/voices` | 观展留言和问卷 | 公众；提交内容仅管理员可查 |
| `/admin` | 管理员登录、留言统计、Excel、图文和媒体管理 | 登录页可打开；管理数据和操作必须登录 |
| `/guide` | 使用说明、拍摄与发布提示 | 公众使用说明，不包含管理数据 |
| `/preview` | 尚未发布的图文草稿预览 | 必须先登录管理员 |
| `/poster` | 生成扫码展板 | 必须先登录管理员 |

普通进入 `/`、刷新总入口或恢复旧 `/#culture` 等片段链接时，仍遵循 1.4 规则先显示凤冠。使用 `/culture`、`/films` 等明确路径时，打开和刷新会保持相应模块；四个公众导航入口仍然保留。草稿预览内切换模块始终留在受保护的 `/preview` 下，不会变成公开草稿地址。公开导航不增加后台入口。

## 1. 凤冠360展示

- **查看：** `/crown`，总入口 `/` 也默认显示此模块。
- **界面归属：** `web/Home.tsx` 的 `crown` 区块；`web/ZoomStage.tsx` 和 `web/zoom-geometry.ts` 负责照片、连续序列、缩放及拖动；分享海报使用 `Home.tsx` 的 `ShareCard`。
- **内容归属：** `src/exhibition.json` 的 `crowns`；内置照片位于 `dist/assets/crown-*.webp`、相关展陈照片；管理员上传的序列保存到当前数据目录。
- **管理：** `/admin` 中的“图文与发布”编辑八展位图文，“影片与360°”上传各展位连续序列。
- **保留要求：** 页面标题“凤冠360展示”；八展位；校徽分享图；只有同一作品的 24—120 张真实连续环绕照片才启用整圈模式。六个空展位和现有照片的实际状态见 [素材清单](MEDIA_INVENTORY.md)。

## 2. 文化寻根与五门课程

- **查看：** `/culture`，在页面上方选择广彩珐琅、陶艺篆刻或蓝白扎染；展开课程名称查看各门课程。
- **界面归属：** `web/Home.tsx` 的 `culture` 区块；`web/ImageGallery.tsx`、`web/Modal.tsx`、`web/ZoomStage.tsx` 共用图片浏览能力。
- **内容归属：** `src/exhibition.json` 的 `courses`；`src/exhibition-model.ts` 负责内容结构与校验；`src/content.json` 为旧内容兼容资料，不代替当前课程主数据。
- **管理：** `/admin` →“图文与发布”，由 `web/Editor.tsx` 编辑系列、教学目标、活动、历史阶段、图片图注、来源和许可。保存草稿后预览，再发布。
- **保留要求：** 文物图列每排三张、16:10；课程图片在标题和正文之前；保留完整原图查看和来源；不把所有课程合称为同一国家级非遗项目。

| 系列与完整课程区标题 | 五门课程 | 年级说明 |
| --- | --- | --- |
| 广彩珐琅：横小广彩珐琅工艺美术课程 | 掐丝珐琅基础课程 | 三至四年级 |
| 广彩珐琅：横小广彩珐琅工艺美术课程 | 掐丝珐琅提高课程 | 五至六年级 |
| 陶艺篆刻：横小陶艺篆刻课程 | 陶艺基础课程 | 三至四年级 |
| 陶艺篆刻：横小陶艺篆刻课程 | 陶艺提高课程 | 五至六年级 |
| 蓝白扎染：横小蓝白扎染课程 | 蓝白扎染与民间美术课程 | 原课程小结未限定年级，不自行补写 |

三个系列各有文化背景、术语、三个历史阶段及每阶段四个观察角度，另有五张文物参考图和五张课程图片。广彩、广州画珐琅和掐丝珐琅需分别说明；保留陶艺与篆刻的文化联系，但不虚构原课程未提供的篆刻活动。

## 3. 影像展厅与三个视频

- **查看：** `/films`，通过上方三个课程按钮切换影片；下方课程简介随选片更新。
- **界面归属：** `web/Home.tsx` 的 `films` 区块；`web/Dashboard.tsx` 的视频上传与 `web/VideoSettings.tsx` 的封面、字幕、显示设置。
- **内容归属：** `src/exhibition.json` 的 `videos` 保存内置展陈信息，`runtime/storage.mjs` 的 `defaultVideos` 保存服务默认影片信息。调整默认影片时应同时核对两处；数据库中管理员已保存的影片设置优先保留。
- **媒体归属：** `dist/assets/film-01.mp4` 至 `film-03.mp4` 及同名 JPG 封面；第二、三部的 Git 源文件为 `media-parts/` 下的分片，由 `scripts/restore-media.mjs` 根据 `media-parts/manifest.json` 还原并校验。
- **管理：** `/admin` →“影片与360°”；上传视频与保存视频资料会立即生效，不属于图文草稿历史。
- **当前状态：** 第一部仍是原有 36 秒静音照片导览；本次上传的《掐丝珐琅.mp4》尚未接入，原因和下一步见 [素材清单](MEDIA_INVENTORY.md)。

## 4. 观展留言与问卷

- **查看：** `/voices`。
- **界面归属：** `web/Home.tsx` 的 `voices` 区块、`web/Feedback.tsx`。
- **接口归属：** `src/feedback.ts`、`src/validation.ts`，构建生成对应 `runtime/*.mjs`；`runtime/server.mjs` 提供 `/api/feedback`。
- **数据归属：** 当前数据目录下的 `gallery.sqlite`；游客昵称、评价和文字反馈不写入源码或 Git。观众需同意后提交，其他观众不能读取留言。
- **管理：** `/admin` 查看与处理；是否开放问卷、关闭后的说明在“图文与发布”中设置并发布。

## 5. 管理后台、统计、Excel 与内容管理

- **查看：** `/admin`，管理员密码由用户在配置终端中设置。后台没有放入公众四入口导航。
- **登录归属：** `web/main.tsx` 的 `Admin` 和 `Guard`；`runtime/server.mjs` 的会话、登录和退出接口；`runtime/storage.mjs` 的密码哈希验证、会话及 SQLite 存储。
- **留言与统计：** `web/Dashboard.tsx`、`src/admin.ts`、`src/xlsx.ts`；可搜索、筛选、标记已阅、删除和导出真实 `.xlsx`。导出包含留言与问卷统计两张表；Excel 是查看材料，不等于可恢复的完整数据库备份。
- **图文发布：** `web/Editor.tsx`、`runtime/content.mjs`、`src/exhibition-model.ts`；支持草稿、受保护预览、发布及最近 10 个图文版本恢复到草稿。
- **运行与展览工具：** `web/OperationsStatus.tsx`、`web/Poster.tsx`、`runtime/qr.mjs`、`src/qrcodegen.ts`；`/poster` 需要管理员登录。
- **边界：** 后台私有接口仍需服务端验证；视频与连续序列不纳入图文版本历史；真实数据迁移与正式发布需另行按用户指示执行。

## 6. 公共素材、配置与部署工具

- **共享样式和入口：** `web/main.tsx`、`web/navigation.ts`、`web/style.css`、`web/revision.css`、根目录 `index.html`。
- **学校 logo：** `dist/assets/school-logo.webp`；浏览器、主屏幕与分享图使用 `school-icon-v14-180.png`、`school-icon-v14-192.png`、`school-icon-v14-512.png`。兼容的旧图标仍保留，不能因此改回旧主题。
- **素材和许可：** `dist/assets/`、`media-parts/`、`materials/`、`THIRD_PARTY_NOTICES.txt`；图片说明、来源和许可同时保留在 `src/exhibition.json`。
- **安装与构建：** `package.json`、`scripts/build.mjs`。构建会生成 `runtime/validation.mjs`、`xlsx.mjs`、`qrcodegen.mjs`、`admin.mjs`、`feedback.mjs`、`exhibition-model.mjs` 以及 `dist/`。修改对应 `src/*.ts` 后重新构建，不只修改生成文件。
- **视频压缩：** `scripts/compress-video.mjs`、`Windows_压缩视频.bat`；原片所在电脑压缩后再上传，详见 [视频压缩方法](VIDEO_COMPRESSION.md)。
- **本机配置与备份：** `scripts/configure.mjs`、`scripts/backup.mjs`、Windows/macOS 启动文件。数据目录通过 `DATA_DIR` 指定；本机预览与已有生产数据分开。
- **部署示例：** `deploy/Caddyfile.example`、`deploy/fenghua.service`、`deploy/install-service.sh`。这是将来配置服务器的示例，文件存在不表示已购买服务或正式上线。
- **检查与交接：** `tests/`、`AGENTS.md`、`README.md`、`docs/PROJECT_CONTEXT.md`、`docs/ACCEPTANCE.md` 和本说明。

## 修改和保存方法

在同一工作分支修改上述归属文件；前端或指定 TypeScript 服务模块改动后运行 `npm run build`，再运行 `npm test`，保存实际检查结果到仓库交接文档。只需使用已构建项目时无需重新安装开发依赖。

运行数据、密码配置、上传文件、数据库、备份和 `node_modules` 不提交 GitHub。提交前检查 `git status` 与差异，按文件选择本次代码、素材和文档；真实留言或管理员密码不能写入提交说明。工作分支及 PR 合并情况见本轮交接记录。

原 Sites 站点的项目记录仍在 [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)。本仓库的本机运行、提交和 PR 不会自动发布到原站，也不代表国内正式上线。
