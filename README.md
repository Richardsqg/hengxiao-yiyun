# 横小艺韵 · Codex 完整项目交接包

这是可继续开发的1.4版独立软件项目，不需要复制整段历史聊天。

## 初学者操作
1. 解压整个压缩包，得到 hengxiao-yiyun 文件夹。不要只拿 index.html 或只复制提示词。
2. 在你使用的Codex中打开本地项目/文件夹，选这个包含 package.json 与 AGENTS.md 的文件夹。
3. 复制 CODEX_FIRST_MESSAGE.txt 全文发送给Codex。它能据此读项目背景、核对环境、检查并准备运行。
4. 以后直接在该项目继续提出修改意见。

若你当前Codex入口只接受GitHub仓库：先将整个项目提交到你自己的私有GitHub仓库，再在该入口选择仓库；ZIP文件或一句提示词不会自动变成云端仓库。当前仓库即从交接包导入的项目，已无需重复上传ZIP。

## 包内内容
- AGENTS.md：交给代码助手的工作约定与架构说明。
- CODEX_FIRST_MESSAGE.txt：第一条可直接复制的接手指令。
- docs/PROJECT_CONTEXT.md：最新需求、五门课程、视频顺序、已知缺口、原线上项目记录。
- docs/ACCEPTANCE.md：接续待办与验收清单。
- web/、src/、runtime/：完整独立版源码。
- dist/：已构建页面、图片、校徽与第一部视频。\n- media-parts/：第二、三部视频的随项目分片；启动、配置或构建时自动校验还原，不需要额外下载。
- tests/、scripts/、deploy/：已有测试、构建/配置/备份脚本与部署示例。
- 原有HTML操作手册与1.2/1.3/1.4修改记录；最新要求以1.4及PROJECT_CONTEXT为准。

不包含生产数据库、管理员密码、在线站点后来上传的素材、全部原始附件或原站Git历史。完整历史聊天也不会自动进入另一个Codex会话；本包已把继续开发需要的上下文写成文档。

## 本机运行
使用 Node.js 24.x，至少24.15且小于25；这是项目实际运行约束。
已有dist时，普通运行无需npm install：
~~~text
node scripts/configure.mjs
node runtime/server.mjs
~~~
配置网址填 http://localhost:3000，管理员密码由你设置，两个备案号可留空。
打开 http://localhost:3000；后台 http://localhost:3000/admin。
不要双击dist/index.html直接当完整应用使用，后台接口需要Node服务。

## 开发与检查
~~~text
npm install
npm run build
npm test
~~~
npm test使用临时数据库及本机测试端口；不需要先运行交互式配置。
运行时data/及backups/不提交Git。安装的node_modules未打包。
修改前端后要重新build。构建脚本会保留dist/assets中的媒体原件。

## 线上关系
原公开地址：https://fenghua-craft-gallery.aurorafly32.chatgpt.site
这份独立版不会自动更新该托管网址。原站的身份认证、D1/R2数据和Sites发布权限需单独接手，详情见docs/PROJECT_CONTEXT.md。
国内服务器及域名尚未部署，不能把“搬入Codex”说成“国内正式上线”。

## 官方操作参考（2026-10-15核对）
https://learn.chatgpt.com/docs/quickstart
官方说明支持打开本地文件夹，并在产品选择中选择Codex进行代码开发。界面名称可能随版本变化，找不到入口时可提供截图继续定位。
旧部署说明保留在 docs/原部署版说明.md。\n\n## GitHub媒体还原\n两部较大的默认影片通过分片入库。scripts/restore-media.mjs 在服务启动、首次配置和构建前自动合并，使用SHA-256校验；已存在且正确的影片不会重复写入。恢复后的film-02.mp4、film-03.mp4已被Git忽略，不要把它们再次提交为重复资源。所有分片均在仓库内，不依赖外部下载服务。
