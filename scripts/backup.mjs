import { backup,DatabaseSync } from 'node:sqlite';
import { mkdir,cp,access,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const data=path.resolve(process.env.DATA_DIR||path.join(root,'data'));const folder=path.join(root,'backups','fenghua-'+new Date().toISOString().replace(/[:.]/g,'-'));
await access(path.join(data,'gallery.sqlite'));await access(path.join(data,'config.json'));
await mkdir(folder,{recursive:true,mode:0o700});const db=new DatabaseSync(path.join(data,'gallery.sqlite'),{readOnly:true});try{await backup(db,path.join(folder,'gallery.sqlite'));}finally{db.close()}await cp(path.join(data,'config.json'),path.join(folder,'config.json'));try{await access(path.join(data,'media'));await cp(path.join(data,'media'),path.join(folder,'media'),{recursive:true})}catch(e){if(e.code!=='ENOENT')throw e;}await writeFile(path.join(data,'backup-status.json'),JSON.stringify({completedAt:new Date().toISOString(),folder}),{mode:0o600});console.log('备份完成：'+folder+'\n备份含后台密码哈希和观众留言，请单独保管，勿上传公开仓库。为保证视频与数据库对应，备份时请暂停后台上传。');
