# 横小艺韵1.4.4 · Mac完整部署下载

这个下载标签只放完整部署包文件，不是源码分支。无需安装旧补丁。
源码提交：[a8fbf10](https://github.com/Richardsqg/hengxiao-yiyun/commit/a8fbf10fdb1de3e5931811756a474d62b510e4b8)。

1. 下载本页下面的两个文件，必须同属Mac版本。
2. 全部解压第1包ZIP，第2段.part2保持原样。
3. 双击解压目录里的“Mac_生成并解压完整包.command”，在弹窗中选择第2段。
4. 等待校验、合并并自动解压，得到“完整部署包/hengxiao-yiyun-1.4.4-desktop”。
5. **先迁移旧data，再第一次启动新程序。** 停止旧服务、保留原目录，按“开始使用.html”完整复制活动data。后来上传的媒体不能只靠复制数据库保留。
6. 在完整项目内双击“macOS_同WiFi扫码启动.command”，首次由你设置管理员密码，手机在允许互通的校园网络扫码。不要关闭服务窗口。只在电脑看时用本系统“启动”入口。

已内置官方Node24.22及相应x64/ARM64运行环境、学校logo、图文、91帧与三部默认影片；Intel Mac需要macOS13.5或更新。程序保留后台编辑、上传、留言与Excel。网页首轮仅请求凤冠当前/相邻帧，原图未压缩。

- [下载第1份：hengxiao-yiyun-1.4.4-Mac-01.zip](https://github.com/Richardsqg/hengxiao-yiyun/raw/refs/tags/v1.4.4-Mac-full/hengxiao-yiyun-1.4.4-Mac-01.zip)（96.0 MiB）
- [下载第2份：hengxiao-yiyun-1.4.4-desktop-Mac.zip.part2](https://github.com/Richardsqg/hengxiao-yiyun/raw/refs/tags/v1.4.4-Mac-full/hengxiao-yiyun-1.4.4-desktop-Mac.zip.part2)（94.1 MiB）

70项Node测试、十个Chromium限速客户端及完整包解压后的服务/问卷/Excel/媒体备份迁移检查通过，详情见validation.json。测试在Linux中完成，未冒充Windows/Mac/iPhone/微信真机或学校Wi-Fi验收。

这是本机/局域网部署。跨楼层无法连接时，先用/connect的“开始连接自检”，让网管确认网段/AP隔离与电脑端口。电脑优先接网线、接电并保持开盖；不是公网正式上线。

Mac文件权限问题可用终端输入bash和一个空格，再将.command拖入终端运行。完整操作、旧数据与手动影片迁移见开始使用.html。不要在旧目录上直接覆盖，不要把data、备份、密码上传GitHub。
