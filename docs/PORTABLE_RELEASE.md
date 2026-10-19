# 横小艺韵 1.4.2 桌面软件

## 最新版：Intel Mac 与 Windows

完整桌面包：<https://github.com/Richardsqg/hengxiao-yiyun/archive/refs/tags/v1.4.2-desktop.zip>。私有仓库，先登录拥有权限的GitHub账号再下载。

- Intel Mac，macOS 13.5及更新：`macOS_一键运行.command`，备份为 `macOS_备份数据.command`；[完整Mac指南](MACOS_GUIDE.md)。
- Windows10/11 x64：`Windows_一键运行.bat`，备份为 `Windows_备份数据.bat`。
- 两套官方Node24.22运行程序分别随包提供；正常使用不需要额外插件或开发依赖。Mac运行包压缩保存，首次校验解压，未将超过100MiB的解压二进制提交Git。
- 同一应用、相同功能和数据格式；各自安装目录的data/portable不会自动同步，不覆盖旧版数据。网页版/Sites保持原来的独立服务。

以下1.4.1Windows发布信息保留为历史；1.4.2验证记录见文末。

## 1.4.1 下载与运行记录

仓库为私有仓库，下载前请在浏览器登录拥有该仓库权限的 GitHub 账号（Richardsqg）。未登录时下载地址会显示404。观众在学校同WiFi扫码参观不需要GitHub账号或ChatGPT账号。

完整软件及可维护源码：<https://github.com/Richardsqg/hengxiao-yiyun/archive/refs/tags/v1.4.1-portable.zip>。

解压后双击 `Windows_一键运行.bat`；已内置官方Windows x64 Node.js24.22.0，运行不需安装Node、npm或联网下载素材。适用于Windows10/11 x64；ARM、macOS、Linux没有包含对应便携运行程序，可按源码运行要求另配置。

第一次设置自己的管理员密码；选1本机使用，选2同WiFi扫码。服务就绪后自动打开电脑上的 `data/portable/打开与扫码.html`：内嵌二维码、观众入口和管理员入口。公众网页仍只有四个入口。Windows可能需要允许专用网络访问；学校访客隔离需信息部门协助。

保留服务窗口和电脑开机。二维码只在当前局域网内使用，IP或端口变化需生成新二维码；不是外地手机流量访问地址。长期校外访问见 [ACCESS_OPTIONS.md](ACCESS_OPTIONS.md)。

## 已包含的完整功能

现有四展区和所有配套静态素材；三系列五课程；三视频播放；图片缩放横滑；八展位逐个管理；24—120张真实360序列上传；图片/图文/视频/封面/VTT字幕管理；图文草稿、私密预览、发布和十个历史版本；留言问卷、统计、筛选与Excel；扫码展板和完整备份。

后续内容维护见 [SOFTWARE_GUIDE.md](SOFTWARE_GUIDE.md)。课程结构和图片槽位数量仍按现有模型固定；校徽、布局、主题和问卷题目等属于源码调整，不把后台描述为可编辑任意细节的通用编辑器。六个空凤冠展位与真实环绕素材仍待补。

## 最新第一片

本次用户上传的“掐丝珐琅.mp4”：29,657,745字节，113.150998秒，960×540，60fps，H.264+AAC双声道。

- 软件中保留原始H.264文件，`dist/assets/film-01-qiasi-20261019-v2.mp4`，不重复压缩。
- 原Sites网页同名路径为23,507,490字节的托管副本，保持60fps、分辨率及原双声道音轨，适应托管文件大小限制。
- 新封面来自本次视频第8秒；旧36秒导览及上次113秒版本仍保留。

## 运行环境和数据

官方Node下载档案的SHA-256已对照nodejs.org公布值验证，来源、版本和node.exe哈希在 `runtime/NODE-RELEASE.json`，许可证在 `runtime/NODE-LICENSE.txt`。

软件初始不携带管理员密码或留言数据库。首次创建独立 `data/portable/`，所有本地业务内容写入该目录；旧版 `data/` 和 `data/local-preview/` 不覆盖。运行依赖使用Node内置HTTP/SQLite，前端已构建；node_modules和开发依赖不打入GitHub下载包。第二、三视频从包内分片校验还原，无需外部下载。

更新软件前暂停上传并双击 `Windows_备份数据.bat`，再将 `backups/` 副本另存。迁移时保留正确的数据目录，不用空目录覆盖已有数据。电脑软件与Sites托管站不自动同步。

## 真实验证范围

47项测试通过，包括LAN来源/Host保护、二维码、问卷UUID后备、登录、图文发布、媒体上传、持久化、Excel和完整备份。隔离首次启动与本机/LAN模式切换、密码复用、旧数据保留已用当前Linux环境验证。Chromium已验证四模块、390px视口、禁用randomUUID后的问卷提交、登录、留言保存和新视频播放。

当前云环境浏览器访问自身私网IP被策略拒绝（Domain forbidden），未绕过该策略；LAN接口与启动测试通过，实际手机扫码仍待现场验证。Windows二进制的来源和结构已验证，但Windows双击、浏览器唤起、防火墙和微信/手机真机没有在Linux环境冒充测试完成。

当前扫码模式不访问境外站点，所以现场观看不依赖翻墙；能否连通仍取决于同一网络、电脑开机、防火墙及校园隔离设置。公网免翻墙需要实际服务器、域名和国内网络验证，本轮未购买、创建或部署国内收费服务。

网页版第6版已发布成功，原站入口不变；最新记录见 [WEB_RELEASE.md](WEB_RELEASE.md)。

## 1.4.2 实际检查记录（2026-10-19）

- `npm run build` 成功，构建产物与此前内容一致，未替换媒体或现有界面。
- `npm test` 实际47项通过、0失败；没有把额外脚本模拟检查合算为API测试。
- Mac两个.command及共享helper通过 `bash -n`，两个修改的MJS通过 `node --check`；`git diff --check`通过。
- 8组Linux隔离stub检查通过：Intel首次解压和缓存复用、中文/空格/&路径、本机/LAN参数、启动与备份退出码、固定data/portable、缺架构包fallback、旧系统/旧Node拒绝、包和缓存损坏拒绝。
- 官方Intel压缩包54,356,645字节，SHA-256为 `495e3f273c645f3c4677d438304cdfc701729ea5dec5728f5c8e76a2dece4b91`，与官方清单一致；内部Node为x86_64 Mach-O，最低系统标记13.5.0。
- 当前执行环境为Linux；Intel Mac双击、Gatekeeper、浏览器唤起、网络权限、Safari及微信/手机真机仍未验证。不要将stub测试描述为Mac真机通过。

新版在原工作分支提交并同步到PR #1；使用新的固定标签 `v1.4.2-desktop`，保留旧标签，不自动合并main，也不再次发布Sites或改变站点内容。
