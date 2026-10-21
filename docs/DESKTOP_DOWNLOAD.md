# 1.4.3完整部署包的两段下载

完整Windows包约156MB，Mac包约170MB，均已内置两种CPU架构的Node、91帧凤冠、已构建网页与视频上传优化。Drive连接工具的单文件上传上限为100MiB，因此每个系统使用两个下载文件；合并后是完整程序，不是增量补丁。

1. 下载对应系统的两个文件。第1包为 `hengxiao-yiyun-1.4.3-Windows-01.zip` 或 `hengxiao-yiyun-1.4.3-Mac-01.zip`；第2段以同系统名和 `.zip.part2` 结尾。
2. 全部解压第1包ZIP。第2段保持原样，不需要打开或解压。
3. Windows双击 `Windows_生成并解压完整包.bat`；Mac双击 `Mac_生成并解压完整包.command`。在文件选择框里选择刚下载的对应系统第2段。
4. 工具用SHA-256核对完整包后自动解压，打开 `完整部署包/hengxiao-yiyun-1.4.3-desktop`。此步骤不需要预装Node。
5. 如需旧密码、留言及上传文件，停止旧服务，在新程序第一次启动之前复制旧项目的整个data文件夹到新项目。
6. 在新程序文件夹内使用 `Windows_同WiFi扫码启动.bat` 或 `macOS_同WiFi扫码启动.command`。手机与电脑连接同一Wi-Fi，扫描自动打开的二维码。详细设置和放大旋转操作见该目录的“开始使用.html”。

合并工具不覆盖旧展馆，不删除下载段；已有同名完整ZIP时先核对哈希，内容不同会停止。目标解压目录若已有未完成的内容也会停止，避免覆盖数据。保留完整报错即可排查。

维护者先运行 `python scripts/package-desktop.py --out <输出目录>`，再运行 `python scripts/package-desktop-transfer.py <同一输出目录>`。运行环境二进制只进入发布包与本地缓存，不提交Git。
