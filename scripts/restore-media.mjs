import {createReadStream} from 'node:fs';
import {readFile,stat,mkdir,open,rename,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function local(relative){const resolved=path.resolve(root,relative);if(!resolved.startsWith(root+path.sep))throw new Error('素材路径必须位于项目目录内');return resolved}
async function sha256(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex')}
export async function restoreMedia(){
 const entries=JSON.parse(await readFile(local('media-parts/manifest.json'),'utf8'));
 for(const entry of entries){
  const destination=local(entry.path);let existing;try{existing=await stat(destination)}catch(error){if(error.code!=='ENOENT')throw error}
  if(existing?.isFile()&&existing.size>0){if(existing.size===entry.bytes&&await sha256(destination)===entry.sha256)continue;throw new Error(entry.path+' 已有不同内容。请先确认并移走该文件，再还原默认素材。')}
  await mkdir(path.dirname(destination),{recursive:true});const temporary=destination+'.restore-'+randomUUID();let handle;
  try{
   handle=await open(temporary,'wx');const hash=createHash('sha256');let bytes=0;
   for(const part of entry.parts)for await(const chunk of createReadStream(local(part))){await handle.writeFile(chunk);hash.update(chunk);bytes+=chunk.length}
   await handle.sync();await handle.close();handle=null;
   if(bytes!==entry.bytes||hash.digest('hex')!==entry.sha256)throw new Error(entry.path+' 的视频分片不完整或校验失败，请重新下载项目');
   await rename(temporary,destination);console.log('已还原默认视频：'+entry.path);
  }catch(error){if(handle)await handle.close();await unlink(temporary).catch(()=>{});throw error}
 }
}
await restoreMedia();
