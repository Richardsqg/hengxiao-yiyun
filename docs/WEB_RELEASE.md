# 横小艺韵：掐丝珐琅视频与网页发布记录

2026-10-19 19:46（北京时间），Sites工具返回发布成功。沿用既有原站，未新建同名站点。

## 可打开的网页地址

- 首页：<https://fenghua-craft-gallery.aurorafly32.chatgpt.site>
- 影像展厅：<https://fenghua-craft-gallery.aurorafly32.chatgpt.site/films>
- 凤冠：`/crown`；文化寻根及五门课程：`/culture`；留言：`/voices`。
- 后台：`/admin`，仍使用原站的ChatGPT身份验证。公众导航不增加后台入口。

## 本次发布

- Sites项目：`appgprj_6ac9a6d9964481919211b933fdc366be`。
- 保存版本：5。
- 版本ID：`appgprj_6ac9a6d9964481919211b933fdc366be~appgver_34d162a16cd88191bc66126771769c61`。
- 托管源提交：`8e3ff2e76b18fdd21c828079df5486d68d5c770a`。
- 部署ID：`appgdep_6ad60301471081918f39429aecd1527f`；最终状态 `succeeded`。

原站继续使用Vinext/Workers、D1/R2和原后台认证；独立GitHub版继续使用React/Vite、Node及SQLite，两套运行方式并存，不直接用Node服务覆盖Worker。没有购买国内服务器、域名或迁移原站留言。

## 第一段视频

用户重新上传文件 `0f74e4eeea09a9c9756f751e4126f734.mp4`，7,260,255字节，113.133333秒，960×540，HEVC+AAC。原片保存于 `materials/videos/掐丝珐琅_上传原片_HEVC_20261019.mp4`。

为浏览器兼容生成H.264副本，保留原AAC音轨、时长和分辨率，19,779,525字节。独立版保存为 `dist/assets/film-01-qiasi-20261019.mp4`，托管版对应 `public/assets/`。封面取自原片第8秒，同名JPG。旧36秒静音照片导览 `film-01.mp4` 仍保留。

影像展厅第一栏标题为“掐丝珐琅”；课程正文标题、另外两片及学校logo保持原有1.4内容。托管版第一片采用媒体版本标记，使旧默认/旧上传设置不会遮蔽本次明确替换；旧设置不删除，以后后台上传和编辑仍正常优先。

## 真实验证范围

- 上传文件与H.264副本均可解析；副本SHA-256：`1b98bee6872b5e0fa7fde8997a69f7d93ebc08c42c21dcd53cd40aa3df0ea50e`。
- 独立版构建成功，40项测试通过。
- 托管版TypeScript、生产构建、40项隔离接口检查及15项缩放/布局检查通过。
- 本地Chromium四模块页面与新视频实际播放通过，113秒、960×540，无页面脚本错误。验证期间本地D1没有生产数据；接口逻辑使用独立SQLite/R2适配器验证，没有写生产留言。
- Sites保存和部署接口已确认第5版上线成功。
- 当前云环境网络策略阻止直接HTTP访问原站域名，因此没有把这次本地检查说成外网直连测试。苹果/安卓/微信及中国内地实际网络访问仍需真机确认；Sites托管成功不等于已部署到国内服务器。

GitHub对应修改继续提交到 `organize/modules-and-handoff-20261018`，随 PR #1 审阅；用户合并后才进入main。聊天归档后从README、HANDOFF和本文件继续。


## 2026-10-19 最新软件与视频（优先于前述历史记录）
第一片现更新为用户本次29,657,745字节的H.264/AAC、60fps双声道版本，113.150998秒，路径 film-01-qiasi-20261019-v2.mp4。软件保留上传原文件，Sites网页用23,507,490字节托管副本，原帧率、分辨率和音轨保持；此前36秒及上一113秒版本不删除。

独立版升级为1.4.1 Windows x64便携软件，已内置官方Node24.22，双击Windows_一键运行.bat，选本机或同WiFi。独立data/portable和私有扫码面板；本轮47项测试通过。下载和真实验证范围见 [便携软件发布记录](PORTABLE_RELEASE.md)，使用菜单见 [操作指南](SOFTWARE_GUIDE.md)，公网方案见 [访问方案](ACCESS_OPTIONS.md)。未购买服务器或域名、未迁移生产数据，Windows/手机现场真机仍待验证。


## 最新网页发布结果

2026-10-19 20:10（北京时间），Sites第6版发布成功。
- 版本ID：`appgprj_6ac9a6d9964481919211b933fdc366be~appgver_133b5f8aebf48191aa5dc6073a293d82`。
- 托管源提交：`faed6b16f6e6a2d6106c5fd3fecc2234d1971a90`。
- 部署ID：`appgdep_6ad60885f0e88191bc36b3264a95b14a`，最终状态`succeeded`。
- 首页仍为 https://fenghua-craft-gallery.aurorafly32.chatgpt.site ，第一片在 `/films`。
- 使用最新60fps双声道视频。国内网络、微信真机直连尚未验证；扫码免外网现场方案见便携软件说明。
