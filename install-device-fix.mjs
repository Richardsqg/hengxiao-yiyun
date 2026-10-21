import {installDesktopHotfix} from './install-desktop-hotfix.mjs';
installDesktopHotfix(process.argv[2],process.argv[3],{
 backupFolder:'device-controls-feedback-20261021',
 successMessage:'跨设备按钮与留言修复已安装。原data、密码、留言和上传素材均保留。',
 instructions:['请用原启动文件重新运行。电脑刷新页面，手机退出旧页面后重新扫码。',
 '只需更新提供展馆的电脑，手机不用安装文件。请测试平移、四入口及一份留言。',
 '原程序文件备份：backups/device-controls-feedback-20261021。']
}).catch(error=>{console.error('修复未完成：'+error.message);process.exitCode=1});
