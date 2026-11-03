# 横小艺韵：Codex 接手说明

## 当前完整版本：1.4.4（2026-11-03）

先看docs/WEAK_NETWORK_1_4_4.md和docs/DESKTOP_1_4_4.html。保留所有既有功能，首屏只加载当前/相邻帧，不要恢复整组91帧预取；切帧等候时保留已成功的画面。web/use-frame-loader.ts负责取消、有限重试与按需缓存，视频保留Range并有重试。已有后台数据和用户后续上传优先；第一片默认另含已取得的113秒60fps掐丝珐琅视频，旧静音导览保留。data与本机后续文件绝不进入发布包或Git。

Windows/Mac完整包均由scripts/package-desktop.py生成，内置双架构官方Node；scripts/package-desktop-transfer.py生成每系统两段下载，下载标签v1.4.4-Windows-full / v1.4.4-Mac-full只含安装文件，不是完整源码分支。70项Node测试与十端Chromium限速模拟通过，仍不能声称学校跨楼层、Mac/Windows系统或微信真机已验收。

## 项目与环境边界

本仓库仅为 `Richardsqg/hengxiao-yiyun` 展馆。每个新任务先在仓库根目录运行 `node .codex/verify-project.mjs`；若包名、Git remote 或目录不匹配，先停止修改并说明。京东助手已独立到 `Richardsqg/jd-helper`，不得在此继续开发、打包或保存它的构件。独立环境准备与后续新项目步骤见 `docs/CODEX_ENVIRONMENT.md`；环境脚本不会自动创建或发布用户账号中的云环境。

2026-10-21跨设备修复记录见 docs/DEVICE_CONTROLS_FEEDBACK_FIX_20261021.md：100%点击平移需自动放大，两个模式按钮持续可用；Android原生浮层只能预留布局避让，不得用禁用用户缩放解决。私网HTTP不能假设crypto.randomUUID存在，留言需安全UUID后备、可见失败反馈及正确幂等。源码与构建一起交付，不碰data。当前67项Node检查及Chromium交互回归通过，未用模拟冒充Mac/Safari/手机真机。小更新标签patch-1.4.3-controls-feedback-20261021只含安装文件，完整源码应检出工作分支或main。

这是已有项目的迁移副本，基线为 1.4.0（2026-10-13），交接整理日期为 2026-10-15。请先读 README.md、docs/PROJECT_CONTEXT.md、docs/ACCEPTANCE.md，再修改代码。

## 项目定位
横琴第一小学传统工艺数字馆；中文；兼容电脑、主流苹果/安卓及微信内置浏览器。用户是编程初学者，沟通要直接、易懂，完成后给可打开的结果。

## 工作原则
- 在现有实现上继续，不要重新生成另一套产品，不要擅自换主题、框架、校徽或课程名称。
- 当前包为独立部署版：React/Vite + Node.js HTTP + SQLite + 本地媒体。前端、后端、素材和已构建页面都在包内。
- 线上旧站是单独的 Sites 托管实现，认证与存储不同。修改本目录不会自动改动旧网址。需要修改旧站时，先按 docs/PROJECT_CONTEXT.md 的线上接手说明处理。
- 1.4 的最新要求优先于 1.2/1.3 的旧说明：学校 logo 图标；默认凤冠首页；标题“凤冠360展示”；文物缩略图为16:10横版、每排三张。
- 照片、视频和馆藏图说明均为实际素材。第一展位有用户提供的91帧凤冠，其余展位按实际资料显示。新1.4.4包默认含已取得的113秒掐丝珐琅视频；用户在电脑里后来上传的文件需保留原data，不能说成已从远程取得。不得虚构其余六个展位的真实环拍或补齐字幕。
- 保留图片图注、来源、许可和现有历史内容兼容。不要将课程整体误称为同一国家级非遗项目。
- 数据、管理员密码、会话、上传文件均在 data/；不要删除或提交它们。先备份再迁移正式数据。
- 无需因普通可逆的本地修改反复询问。涉及正式部署、费用、账号、域名或生产数据变更时遵循用户当次授权及实际平台权限。
- 未进行的真机测试、国内网络测试和部署不能宣称已经完成。

## 常用命令
运行要求以 package.json 为准：Node.js >=24.15.0 且 <25。
- npm test：当前70项临时数据库/本机HTTP等测试，不需要先配置正式 data/。
- npm install：仅开发/重新构建需要安装开发依赖。
- npm run build：生成前端并转译指定 TypeScript 服务模块。
- npm run configure：交互式设置站点网址和管理员密码；不要把密码写入源码。
- npm start：运行服务，默认仅监听 127.0.0.1:3000。
- npm run backup：备份独立版数据，先暂停后台上传。

## 修改文件
- web/：React界面；Home.tsx、ImageGallery.tsx、ZoomStage.tsx、revision.css 是近期主要修改处。
- src/exhibition.json：三系列/五门课程、八展位、默认影片和图片资料。
- src/：需转译的 TypeScript 后端模块和兼容资料。
- runtime/server.mjs、storage.mjs、content.mjs：Node服务、存储和内容发布。
- scripts/build.mjs 指定的 runtime 模块是生成文件，优先改相应 src/*.ts，再构建。
- media-parts/：两部较大视频分片及校验清单；scripts/restore-media.mjs 会在启动/配置/构建时自动还原默认MP4。不要删除分片，不要把还原后的两部MP4重复提交。\n- dist/：可直接提供服务的页面与媒体。不要只改压缩后的JS。不要删 dist/assets/ 的媒体原件，构建脚本会保留它们。
- deploy/：Caddy和systemd配置示例。
- tests/：已有接口集成测试。
- src/mp4-inspect.ts 与 runtime/video-validation.mjs：共享的视频轨道/编码检查。上传上限400MiB，发布前核对H.264 8位4:2:0与可选AAC-LC，不能只凭MP4后缀或ftyp标记发布。
- 视频上传/播放补充和原视频兼容版导出见 docs/VIDEO_UPLOAD_FIX_20261020.md；凤冠与Mac本机/局域网增量说明见 docs/MEDIA_SUPPLEMENT_20261020.md。
- 1.4.3-desktop整合部署见 docs/DESKTOP_1_4_3.html；scripts/package-desktop.py校验并打包官方Mac/Windows双架构Node，运行环境只进入发布ZIP，不提交Git。凤冠在放大后默认拖动旋转，可切换平移；旋转箭头、滑条和自动播放必须保留缩放与平移。针对交互的浏览器检查为 tests/zoom-spin-browser.py。

## 交付与验证
针对变更做必要检查，不为简单文案/样式反复增加测试。只有业务代码改动或基线迁移风险时运行相关测试。
报告说明：改了什么、如何打开、验证了什么、还缺什么。未配置服务器时只交付本地结果，不把预览说成国内正式上线。
