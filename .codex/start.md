# 展馆环境启动说明

先在仓库根目录运行 `node .codex/verify-project.mjs`。首次准备使用 `bash .codex/setup.sh`，验证使用 `bash .codex/check.sh`。

已有配置时按 README 运行 `npm start`；首次启动的密码和网址由用户通过 `npm run configure` 设置。环境准备不自动执行 configure，不覆盖 data/、backups/ 或已有管理员密码。

云环境可先运行测试，不需要正式数据库或生产凭据。要提供网页预览时，先核对当前是否已有可用配置和服务端口，不复制其他项目的环境变量。

本仓库只属于展馆。京东工具在 Richardsqg/jd-helper，不能把它的源码、打包依赖或登录资料放到此项目。
